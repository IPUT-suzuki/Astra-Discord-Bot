import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    type ChatInputCommandInteraction,
} from 'discord.js';
import type { DiscordUserData } from '../../utils/interface.js';
import { Check } from './common/check.js';
import { listener } from './common/listener.js';
import { getUserRankFromDB } from '../../database/db.js';
import { ValoRank } from './rank.js';

export class ValoTeam {
    interaction: ChatInputCommandInteraction | ButtonInteraction;
    selectOption: String;
    selectExcludeOption: Boolean;
    userList: DiscordUserData[];
    includeUserList: DiscordUserData[];
    constructor(interaction: ChatInputCommandInteraction) {
        this.interaction = interaction;
        this.selectOption = this.interaction.options.getString('option', true);
        this.selectExcludeOption = this.interaction.options.getBoolean('exclude-option', false) ?? false;
        this.userList = [];
        this.includeUserList = [];
    }

    async start() {
        const errorEmbed = Check.valoTeamCheck(this.interaction as ChatInputCommandInteraction);
        if (errorEmbed) {
            await this.interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }
        const voiceChannel = (this.interaction.member as GuildMember).voice.channel;
        this.userList = Array.from(voiceChannel!.members.values()).map((member) => ({
            userName: member.displayName,
            userId: member.user.id,
            userIcon: member.user.displayAvatarURL(),
        }));
        if (this.selectExcludeOption || this.userList.length > 10) {
            //除外設定が有効なとき又はVC内ユーザーが10を超えている場合。
            this.includeUserList = this.userList;
            try {
                await this.selectExcludeUser();
            } catch {
                return;
            }
            this.userList = this.includeUserList;
        }
        try {
            await this.checkUnregisterUsers();
        } catch {
            return;
        }
        if (this.selectOption === 'max') {
        } else if (this.selectOption === 'now') {
        } else if (this.selectOption === 'ranodm') {
        }
    }
    private async selectExcludeUser() {
        while (true) {
            const payload = {
                embeds: [Embed.excludeInfo(this.userList, this.includeUserList)],
                components: [...Button.excludeUserButton(this.userList, this.includeUserList), Button.confirmButton()],
            };
            if (this.interaction.isButton()) {
                await this.interaction.update(payload);
            } else {
                await this.interaction.reply(payload);
            }
            const reply = await this.interaction.fetchReply();
            this.interaction = (await listener(reply, 'on_', this.interaction)) as ButtonInteraction;
            if (this.interaction.customId.endsWith('confirm')) {
                break;
            } else if (this.interaction.customId.includes('_exclude_')) {
                const userId = this.interaction.customId.replace('on_exclude_', '');
                this.includeUserList = this.includeUserList.filter((user) => user.userId !== userId);
            } else if (this.interaction.customId.includes('_include_')) {
                const userId = this.interaction.customId.replace('on_include_', '');
                this.includeUserList.push(this.userList.find((user) => user.userId === userId)!);
            }
        }
    }

    private async checkUnregisterUsers() {
        const unregisterUsers: DiscordUserData[] = [];
        for (const user of this.userList) {
            const result = await getUserRankFromDB(user.userId);
            if (!result) {
                unregisterUsers.push(user);
            }
        }
        if (unregisterUsers.length > 0) {
            this.interaction.reply({
                embeds: Embed.unregisterUsers(unregisterUsers),
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(Button.sendButton(), Button.notSendButton())],
                flags: MessageFlags.Ephemeral,
            });
        } else {
            return;
        }
        const reply = await this.interaction.fetchReply();
        this.interaction = (await listener(reply, 'on_', this.interaction)) as ButtonInteraction;
        if (this.interaction.customId.endsWith('notsend')) {
            return;
        } else if (this.interaction.customId.endsWith('send')) {
            await this.sendRankRegisterDm(unregisterUsers);
        }
    }

    private async sendRankRegisterDm(userList: DiscordUserData[]) {
        let sendResult: { user: DiscordUserData; flag: boolean }[] = [];
        await (this.interaction as ButtonInteraction).update({
            embeds: [Embed.sendDm()],
            components: [],
        });
        let callback: Promise<void>[] = [];
        for (const user of userList) {
            const recipient = await this.interaction.client.users.fetch(user.userId);
            try {
                const valoRank = new ValoRank(this.interaction, recipient);
                callback.push(valoRank.rankSelectStep());
                sendResult.push({ user, flag: true });
            } catch {
                sendResult.push({ user, flag: false });
            }
            this.interaction.editReply({
                embeds: [Embed.sendDm(sendResult)],
            });
        }
        this.interaction.editReply({
            embeds: [Embed.sendDm(sendResult, true), Embed.waitingRegister()],
        });
        //全員の登録完了を待つ
        //時間でエラー出すように後で修正
        await Promise.race([
            Promise.all(callback),
            new Promise((_, reject) => setTimeout(() => reject(), 10 * 60 * 100)), // 10分でタイムアウト
        ]).catch(() => {
            this.interaction.editReply({
                embeds: [Embed.registerTimeout()],
            });
            throw new Error('タイムアウトにより処理を中断');
        });
        this.interaction.editReply({
            embeds: [Embed.sendDm(sendResult, true), Embed.successRegister()],
        });
    }
}

class Embed {
    static excludeInfo(userList: DiscordUserData[], includeUserList: DiscordUserData[]) {
        const fields = userList.map((user) => ({
            name: `${includeUserList.includes(user!) ? ':blue_circle:' : ':red_circle:'} ${user?.userName}`,
            value: '',
            inline: true,
        }));
        return new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('除外するユーザーを選択してください')
            .setFields(fields)
            .setFooter({ text: '🔵 -- 未除外\n🔴 -- 除外済み' });
    }

    static unregisterUsers(userList: DiscordUserData[]) {
        let fields = [];
        for (const user of userList) {
            fields.push({ name: '', value: `<@${user.userId}>`, inline: false });
        }
        const embed1 = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('以下のユーザーのランク登録が完了していません')
            .setFields(fields);
        const embed2 = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('DMでランク登録を促すメッセージを送信しますか?')
            .setFooter({
                text: '※送信しないを選択した場合該当ユーザーはランクなしと同等の扱いでチーム分けを開始します',
            });
        return [embed1, embed2];
    }

    static sendDm(sendResult?: { user: DiscordUserData; flag: boolean }[], successFlag?: boolean) {
        let fields = [];
        if (sendResult) {
            for (const result of sendResult) {
                fields.push({
                    name: '',
                    value: `${result.flag ? ':white_check_mark:' : ':x:'} <@${result.user.userId}>`,
                    inline: false,
                });
            }
        }
        if (successFlag) {
            return new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('DMの送信が完了しました')
                .setFields(fields)
                .setFooter({ text: '✅️ -- 成功\n❌️ -- 失敗' });
        }
        return new EmbedBuilder().setColor(Colors.Yellow).setTitle('DM送信中...').setFields(fields);
    }

    static waitingRegister() {
        return (
            new EmbedBuilder()
                .setColor(Colors.Yellow)
                .setTitle('ランク登録を待っています....')
                //ここにメッセージ
                .setFooter({ text: '必ずDMへ送られたメッセージからランク登録をお願いします\n' })
        );
    }

    static registerTimeout() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('TIMEOUT')
            .setDescription(
                '制限時間内にランク登録が終わらなかったためプロセスを強制終了しました\n再度コマンドを実行することでチーム分けが可能です'
            );
    }

    static successRegister() {
        return new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('ランク登録が完了しました')
            .setDescription('チーム分けを実行します');
    }
}
class Button {
    static excludeUserButton(userList: DiscordUserData[], includeUserList: DiscordUserData[]) {
        const buttons: ButtonBuilder[] = userList.map((user) => {
            if (includeUserList.length === 2 && includeUserList.includes(user)) {
                return new ButtonBuilder()
                    .setCustomId(`no_select_${user.userId}`)
                    .setLabel(user.userName)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);
            }
            const isIncludes = includeUserList.includes(user);
            return new ButtonBuilder()
                .setCustomId(isIncludes ? `on_exclude_${user.userId}` : `on_include_${user.userId}`)
                .setLabel(user.userName)
                .setStyle(isIncludes ? ButtonStyle.Primary : ButtonStyle.Danger);
        });
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        for (let i = 0; i < buttons.length; i += 3) {
            rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 3)));
        }
        return rows;
    }

    static confirmButton() {
        const button = new ButtonBuilder().setCustomId('on_confirm').setLabel('確定').setStyle(ButtonStyle.Success);
        return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    }

    static sendButton() {
        return new ButtonBuilder().setCustomId('on_send').setLabel('送信する').setStyle(ButtonStyle.Primary);
    }

    static notSendButton() {
        return new ButtonBuilder().setCustomId('on_notsend').setLabel('送信しない').setStyle(ButtonStyle.Danger);
    }
}
