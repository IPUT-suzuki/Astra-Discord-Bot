import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    User,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type GuildMember,
} from 'discord.js';
import type { DBUserRankData, DiscordUserData } from '../../utils/interface.js';
import { deleteUserRankFromDB, getUserRankFromDB, insertUserRankToDB } from '../../database/db.js';
import { rankInfo } from '../../utils/valoconfig.js';
import { listener } from './common/listener.js';

export class ValoRank {
    interaction: ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction;
    user: DiscordUserData;
    rank: DBUserRankData;
    recipient: User | null;
    recipientUser: DiscordUserData | null;
    constructor(interaction: ChatInputCommandInteraction | ButtonInteraction, recipient?: User) {
        this.interaction = interaction;
        this.user = {
            userName: (interaction.member as GuildMember)?.displayName ?? interaction.user.username,
            userId: interaction.user.id,
            userIcon: interaction.user.displayAvatarURL(),
        };
        this.rank = {
            maxCategory: null,
            maxTier: null,
            nowCategory: null,
            nowTier: null,
            timeStamp: null,
        };
        this.recipient = recipient ?? null;
        this.recipientUser = recipient
            ? {
                  userName: recipient.username,
                  userId: recipient.id,
                  userIcon: recipient.displayAvatarURL(),
              }
            : null;
    }

    async start() {
        const dbUserRank = await getUserRankFromDB(this.user.userId);
        if (!dbUserRank) {
            try {
                await this.rankSelectStep();
            } catch {
                return;
            }
        } else {
            try {
                await this.rankUpdateOrDeleteStep(dbUserRank);
            } catch {
                return;
            }
        }
    }

    private async rankUpdateOrDeleteStep(dbUserRank: DBUserRankData) {
        this.rank = dbUserRank;
        let embed = Embed.rankInfo(this.rank, this.user);
        embed.setColor(Colors.Green);
        embed.setTitle('以下の内容でランク情報が登録されています');
        const rows = new ActionRowBuilder<ButtonBuilder>().addComponents(Button.rankUpdateButton(), Button.rankDeleteButton());
        this.interaction.reply({
            embeds: [embed],
            components: [rows],
            flags: MessageFlags.Ephemeral,
        });
        this.interaction = (await listener(
            await this.interaction.fetchReply(),
            'on_',
            this.interaction
        )) as StringSelectMenuInteraction;
        if (this.interaction.customId.endsWith('delete')) {
            await deleteUserRankFromDB(this.user.userId);
            await this.interaction.update({
                embeds: [Embed.successDelete()],
                components: [],
            });
        } else if (this.interaction.customId.endsWith('update')) {
            this.rank = {
                maxCategory: null,
                maxTier: null,
                nowCategory: null,
                nowTier: null,
                timeStamp: null,
            };
            await this.rankSelectStep();
        }
    }
    async rankSelectStep() {
        await this.categorySelect();
        await this.tierSelect();
        await this.categorySelect();
        await this.tierSelect();
        await this.successRankRegister();
    }

    private async categorySelect() {
        if (this.rank.maxCategory === 'ランクなし') {
            this.rank.nowCategory = this.rank.maxCategory;
            return;
        }
        const payload = {
            embeds: [Embed.rankInfo(this.rank, this.recipientUser ?? this.user)],
            components: [Button.selectRankCategory(this.rank)],
        };
        let message = null;
        if (this.recipient) {
            payload.embeds[0]
                ?.setTitle('ランク登録のお願い')
                .setDescription(
                    `<@${this.recipientUser!.userId}>さん、VALORANTのランク登録が未登録です\n以下から登録処理を行ってください`
                );

            message = await this.recipient.send(payload);
            this.recipient = null;
        } else if (this.interaction.isButton() || this.interaction.isStringSelectMenu()) {
            await this.interaction.update(payload);
        } else if (this.interaction.isRepliable()) {
            await this.interaction.reply({
                ...payload,
                flags: MessageFlags.Ephemeral,
            });
        }
        let reply = message ?? (await this.interaction.fetchReply());
        this.interaction = (await listener(reply, 'category_', this.interaction)) as StringSelectMenuInteraction;
        if (this.interaction.customId.endsWith('max')) {
            this.rank.maxCategory = this.interaction.values[0] ?? null;
        } else {
            this.rank.nowCategory = this.interaction.values[0] ?? null;
        }
    }

    private async tierSelect() {
        if (rankInfo.noTireCategory?.includes(this.rank.maxCategory!)) {
            return;
        } else if (rankInfo.noTireCategory?.includes(this.rank.nowCategory!)) {
            return;
        }
        await (this.interaction as StringSelectMenuInteraction).update({
            embeds: [Embed.rankInfo(this.rank, this.user)],
            components: [Button.selectRankTier(this.rank)],
        });
        let reply = await this.interaction.fetchReply();
        this.interaction = (await listener(reply, 'tier_', this.interaction)) as StringSelectMenuInteraction;
        if (this.interaction.customId.endsWith('max')) {
            this.rank.maxTier = this.interaction.values[0] ?? null;
        } else {
            this.rank.nowTier = this.interaction.values[0] ?? null;
        }
    }

    private async successRankRegister() {
        await (this.interaction as StringSelectMenuInteraction).update({
            embeds: [Embed.waitingRegister()],
            components: [],
        });
        this.rank.timeStamp = await this.getTimeStamp();
        let embed = Embed.rankInfo(this.rank, this.recipientUser ?? this.user);
        embed.setTitle('以下の内容でランク情報を登録しました');
        embed.setColor(Colors.Green);
        embed.setFooter({ text: '/valo rankコマンドで何度でも更新・削除が可能です' });
        await insertUserRankToDB(this.recipientUser ?? this.user, this.rank);
        await (this.interaction as StringSelectMenuInteraction).followUp({
            embeds: [embed],
            components: [],
        });
    }

    private async getTimeStamp() {
        const now = new Date();
        const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const year = japanTime.getFullYear();
        const month = String(japanTime.getMonth() + 1).padStart(2, '0');
        const day = String(japanTime.getDate()).padStart(2, '0');
        const hours = String(japanTime.getHours()).padStart(2, '0');
        const minutes = String(japanTime.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
}

class Embed {
    static successDelete() {
        return new EmbedBuilder()
            .setTitle('登録されているランク情報を削除しました')
            .setColor(Colors.Green)
            .setDescription('`/valo rank`コマンドで何度でも再登録可能です');
    }

    static waitingRegister() {
        return new EmbedBuilder().setTitle('登録処理中...').setColor(Colors.Yellow);
    }

    static rankInfo(rankData: DBUserRankData, userData: DiscordUserData) {
        let embed = new EmbedBuilder()
            .setTitle('ランク情報の登録')
            .setColor(Colors.Yellow)
            .setAuthor({ name: userData.userName, iconURL: userData.userIcon });
        let fields = [
            { name: '最高ランク', value: '', inline: true },
            { name: '➤', value: '', inline: true },
            { name: '現在登録中', value: '', inline: true },
            { name: '現在ランク', value: '', inline: true },
            { name: '➤', value: '', inline: true },
            { name: '最高ランクの登録を完了させてください', value: '', inline: true },
        ];
        if (rankData.maxCategory) {
            fields[2] = { name: rankData.maxCategory, value: '', inline: true };
        }
        if (rankData.maxTier) {
            let fullRankPass = rankData.maxCategory + rankData.maxTier;
            let rankIcon = rankInfo.rankIcon[fullRankPass];
            fields[2] = { name: rankIcon + fullRankPass, value: '', inline: true };
            fields[5] = { name: '現在登録中', value: '', inline: true };
        }
        if (rankData.nowCategory) {
            fields[5] = { name: rankData.nowCategory, value: '', inline: true };
        }
        if (rankData.nowTier) {
            let fullRankPass = rankData.nowCategory + rankData.nowTier;
            let rankIcon = rankInfo.rankIcon[fullRankPass];
            fields[5] = { name: rankIcon + fullRankPass, value: '', inline: true };
        }
        if (rankInfo.noTireCategory.includes(rankData.maxCategory ?? '')) {
            let fullRankPass = rankData.maxCategory!;
            let rankIcon = rankInfo.rankIcon[fullRankPass];
            fields[2] = { name: rankIcon + fullRankPass, value: '', inline: true };
            fields[5] = { name: '現在登録中', value: '', inline: true };
        }
        if (rankInfo.noTireCategory.includes(rankData.nowCategory ?? '')) {
            let fullRankPass = rankData.nowCategory!;
            let rankIcon = rankInfo.rankIcon[fullRankPass];
            fields[5] = { name: rankIcon + fullRankPass, value: '', inline: true };
        }
        if (rankData.timeStamp) {
            fields.push({
                name: 'LastUpdate',
                value: ':clock4:' + rankData.timeStamp,
                inline: false,
            });
        }
        embed.setFields(fields);
        return embed;
    }
}

class Button {
    static selectRankCategory(rankData: DBUserRankData) {
        let customId = '';
        let options: { label: string; value: string }[] = [];
        let placeholder = '';
        if (!rankData.maxCategory) {
            customId = 'category_max';
            placeholder = '最高ランクカテゴリーを選択してください';
            options = rankInfo.category.map((category) => ({
                label: category,
                value: category,
            }));
        } else if (!rankData.nowCategory) {
            customId = 'category_now';
            placeholder = '現在ランクカテゴリーを選択してください';
            const maxIndex = rankInfo.category.indexOf(rankData.maxCategory);
            options = rankInfo.category.slice(0, maxIndex + 1).map((category) => ({
                label: category,
                value: category,
            }));
        }
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setOptions(options)
        );
    }

    static selectRankTier(rankData: DBUserRankData) {
        let customId = '';
        let options: { label: string; value: string }[] = [];
        let placeholder = '';
        if (!rankData.maxTier) {
            customId = 'tier_max';
            placeholder = '最高ランクティアを選択してください';
        } else if (!rankData.nowTier) {
            customId = 'tier_now';
            placeholder = '現在ランクティアを選択してください';
        }
        if (rankData.maxCategory === rankData.nowCategory) {
            const maxIndex = rankInfo.tier.indexOf(rankData.maxTier!);
            options = rankInfo.tier.slice(0, maxIndex + 1).map((tier) => ({
                label: tier,
                value: tier,
            }));
        } else {
            options = rankInfo.tier.map((tier) => ({
                label: tier,
                value: tier,
            }));
        }
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setOptions(options)
        );
    }

    static rankDeleteButton() {
        return new ButtonBuilder().setCustomId('on_delete').setStyle(ButtonStyle.Danger).setLabel('削除');
    }

    static rankUpdateButton() {
        return new ButtonBuilder().setCustomId('on_update').setStyle(ButtonStyle.Primary).setLabel('更新');
    }
}
