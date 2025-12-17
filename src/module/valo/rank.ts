import {
    Colors,
    EmbedBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ChatInputCommandInteraction,
    StringSelectMenuInteraction,
    GuildMember,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    Options, // 追加
} from 'discord.js';
import { deleteUserRankFromDB, getUserRankFromDB, insertUserRankToDB } from '../../database/db.js';
import type { DBuserRankData, RankInfo } from '../../utils/interface.js';
import { listener } from './common/listener.js';
import { rankInfo } from '../../utils/valoconfig.js';
import { Log } from '../../utils/logger.js';
import { timeoutEmbed } from './common/timeout.js';

export class ValoRank {
    i: ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction;
    originInteraction: ChatInputCommandInteraction;
    rankinfo: RankInfo;
    data: DBuserRankData;
    constructor(interaction: ChatInputCommandInteraction) {
        this.i = interaction;
        this.originInteraction = interaction;
        this.rankinfo = rankInfo;
        this.data = {
            userid: interaction.user.id,
            username: this.i.member ? (this.i.member as GuildMember).displayName : this.i.user.username,
            usericon: interaction.user.displayAvatarURL(),
            maxCategory: null,
            maxTier: null,
            nowCategory: null,
            nowTier: null,
            timeStamp: null,
        };
    }

    async start() {
        const dbUserRank = await getUserRankFromDB(this.i.user.id);
        if (!dbUserRank) {
            this.rankSelectStep();
        } else {
            // データベースから取得したデータにusernameとusericonを追加
            this.data = {
                ...dbUserRank,
                username: this.i.member ? (this.i.member as GuildMember).displayName : this.i.user.username,
                usericon: this.i.user.displayAvatarURL(),
            };
            const embed = Embed.rankRegisterInfo(this.rankinfo, this.data)
                .setTitle('以下の内容でランク情報が登録されています')
                .setColor(Colors.Green);
            let rows = new ActionRowBuilder<ButtonBuilder>().addComponents(
                Button.rankUpdateButton(),
                Button.rankDeleteButton()
            );
            await this.i.reply({
                embeds: [embed],
                components: [rows],
                flags: MessageFlags.Ephemeral,
            });
            this.i = (await listener(await this.i.fetchReply(), 'on_')) as ButtonInteraction;
            if (!this.i) {
                await this.originInteraction.editReply({
                    embeds: [timeoutEmbed()],
                    components: [],
                });
                return;
            }
            if (this.i.customId.endsWith('delete')) {
                await deleteUserRankFromDB(this.data.userid);
                await this.i.update({
                    embeds: [Embed.successDelete()],
                    components: [],
                });
            } else if (this.i.customId.endsWith('update')) {
                this.data.maxCategory = null;
                this.data.maxTier = null;
                this.data.nowCategory = null;
                this.data.nowTier = null;
                this.data.timeStamp = null;
                await this.rankSelectStep();
            }
        }
    }

    private async rankSelectStep() {
        let embed: EmbedBuilder;
        let components: ActionRowBuilder<StringSelectMenuBuilder>;
        //最高ランクカテゴリ処理
        if (!this.data.maxCategory) {
            embed = Embed.rankRegisterInfo(this.rankinfo, this.data);
            components = Button.rankCategorySelect(this.rankinfo, this.data);
            await this.sendRankSelectOption(embed, components, 'category_');
            this.data.maxCategory = (this.i as StringSelectMenuInteraction).values[0] ?? '';
        }
        //最高ランクティア処理
        if (this.rankinfo.noTireCategory.includes(this.data.maxCategory)) {
            //例外処理
            if (this.data.maxCategory === 'ランクなし') {
                this.data.nowCategory = this.data.maxCategory;
            }
        } else if (!this.data.maxTier) {
            //通常処理
            embed = Embed.rankRegisterInfo(this.rankinfo, this.data);
            components = Button.rankTierSelect(this.rankinfo, this.data);
            await this.sendRankSelectOption(embed, components, 'tier_');
            this.data.maxTier = (this.i as StringSelectMenuInteraction).values[0] ?? '';
        }
        //現在ランクカテゴリ処理
        if (!this.data.nowCategory) {
            //通常処理
            embed = Embed.rankRegisterInfo(this.rankinfo, this.data);
            components = Button.rankCategorySelect(this.rankinfo, this.data);
            await this.sendRankSelectOption(embed, components, 'category_');
            this.data.nowCategory = (this.i as StringSelectMenuInteraction).values[0] ?? '';
        }
        //現在ランクティア処理
        if (this.rankinfo.noTireCategory.includes(this.data.nowCategory)) {
            //ランクティアを決める必要がない場合の処理
        } else if (!this.data.nowTier) {
            //通常処理
            embed = Embed.rankRegisterInfo(this.rankinfo, this.data);
            components = Button.rankTierSelect(this.rankinfo, this.data);
            await this.sendRankSelectOption(embed, components, 'tier_');
            this.data.nowTier = (this.i as StringSelectMenuInteraction).values[0] ?? '';
        }
        this.data.timeStamp = this.getTimestamp();
        await insertUserRankToDB(this.data);
        await (this.i as StringSelectMenuInteraction).update({
            embeds: [Embed.waitingRegister()],
            components: [],
        });
        embed = Embed.rankRegisterInfo(this.rankinfo, this.data)
            .setTitle('以下の内容でランク情報を登録しました')
            .setColor(Colors.Green)
            .setFooter({ text: '/valo rankコマンドで何度でも更新・削除が可能です' });

        await (this.i as StringSelectMenuInteraction).followUp({ embeds: [embed] });
    }

    private async sendRankSelectOption(
        embed: EmbedBuilder,
        component: ActionRowBuilder<StringSelectMenuBuilder>,
        prefix: string
    ) {
        if (this.i instanceof ChatInputCommandInteraction) {
            await this.i.reply({
                embeds: [embed],
                components: [component],
                flags: MessageFlags.Ephemeral,
            });
        } else if (this.i instanceof StringSelectMenuInteraction || this.i instanceof ButtonInteraction) {
            await this.i.update({
                embeds: [embed],
                components: [component],
            });
        }
        this.i = (await listener(await this.i.fetchReply(), prefix)) as StringSelectMenuInteraction;
        if (!this.i) {
            await this.originInteraction.editReply({
                embeds: [timeoutEmbed()],
                components: [],
            });
            return;
        }
    }

    private getTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
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
    static rankRegisterInfo(rankinfo: RankInfo, data: DBuserRankData) {
        const maxRank = (data.maxCategory ?? '現在登録中') + (data.maxTier ?? '');
        const nowRank = (data.nowCategory ?? '現在登録中') + (data.nowTier ?? '');
        const maxRankIcon = rankinfo.rankIcon[maxRank] ?? '';
        const nowRankIcon = rankinfo.rankIcon[nowRank] ?? '';
        const nowRankDisplay = maxRankIcon ? nowRankIcon + nowRank : '最高ランクの登録を完了させてください';
        let embed = new EmbedBuilder()
            .setTitle('ランク情報の登録')
            .setColor(Colors.Yellow)
            .setAuthor({ name: data.username, iconURL: data.usericon })
            .setFields([
                { name: '最高ランク', value: '', inline: true },
                { name: '➤', value: '', inline: true },
                { name: maxRankIcon + maxRank, value: '', inline: true },
                { name: '現在ランク', value: '', inline: true },
                { name: '➤', value: '', inline: true },
                { name: nowRankDisplay, value: '', inline: true },
            ]);
        if (data.timeStamp) {
            embed.addFields({ name: 'LastUpdate', value: ':clock4:' + (data.timeStamp ?? ''), inline: false });
        }
        return embed;
    }
}

class Button {
    static rankCategorySelect(rankinfo: RankInfo, data: DBuserRankData) {
        // maxCategoryが未選択なら最高ランクカテゴリー選択、それ以降は現在ランクカテゴリー選択
        const isMaxCategory = !data.maxCategory;
        const customId = isMaxCategory ? 'category_max' : 'category_now';
        const placeHolder = isMaxCategory
            ? '最高ランクカテゴリーを選択してください'
            : '現在ランクカテゴリーを選択してください';
        let options;
        if (isMaxCategory) {
            options = rankinfo.category.map((category) => ({
                label: category,
                value: category,
            }));
        } else {
            const maxIndex = rankinfo.category.indexOf(data.maxCategory ?? '');
            options = rankinfo.category.slice(0, maxIndex + 1).map((cat) => ({
                label: cat,
                value: cat,
            }));
        }
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeHolder).setOptions(options)
        );
    }

    static rankTierSelect(rankinfo: RankInfo, data: DBuserRankData) {
        const isMaxTier = !data.maxTier;
        const customId = isMaxTier ? 'tier_max' : 'tier_now';
        const placeHolder = isMaxTier
            ? `${data.maxCategory}のティアを選択してください`
            : `${data.nowCategory}のティアを選択してください`;
        let options;
        if (data.maxCategory === data.nowCategory) {
            const maxIndex = rankinfo.tier.indexOf(data.maxTier ?? '');
            options = rankinfo.tier.slice(0, maxIndex + 1).map((tier) => ({
                label: tier,
                value: tier,
            }));
        } else {
            options = rankinfo.tier.map((tier) => ({
                label: tier,
                value: tier,
            }));
        }
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeHolder).setOptions(options)
        );
    }

    static rankDeleteButton() {
        return new ButtonBuilder().setCustomId('on_delete').setStyle(ButtonStyle.Danger).setLabel('削除');
    }
    static rankUpdateButton() {
        return new ButtonBuilder().setCustomId('on_update').setStyle(ButtonStyle.Primary).setLabel('更新');
    }
}
