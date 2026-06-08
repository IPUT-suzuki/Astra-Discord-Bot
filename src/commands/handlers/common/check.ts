import {
    Colors,
    EmbedBuilder,
    MessageFlags,
    type ChatInputCommandInteraction,
    type GuildMember,
} from 'discord.js';
import { Log } from '../../../utils/log.js';

export class Check {
    static async isCommandChannel(i: ChatInputCommandInteraction) {
        const result = Boolean(i.guild);
        if (!result) {
            Log.warn('Command rejected because it was used in a direct message');
            await Check.errorSender(i, Embed.commandUsedInDM(), false);
        }
        return result;
    }

    static async isUserVcState(i: ChatInputCommandInteraction) {
        const result = Boolean((i.member as GuildMember).voice.channel);
        if (!result) {
            Log.warn('Command rejected because the user is not in a voice channel');
            await Check.errorSender(i, Embed.userNoConnectVC(), true);
        }
        return result;
    }

    static async underVcUser(i: ChatInputCommandInteraction, value: number) {
        const memberCount = (i.member as GuildMember)?.voice?.channel?.members.size ?? 0;
        const result = memberCount >= value;
        if (!result) {
            Log.warn('Command rejected because voice channel member count is below the minimum', {
                memberCount,
                minimum: value,
            });
            await Check.errorSender(i, Embed.vcUserUnderLimit(value), true);
        }
        return result;
    }

    static async overVcUser(i: ChatInputCommandInteraction, value: number) {
        const memberCount = (i.member as GuildMember)?.voice?.channel?.members.size ?? 0;
        const result = memberCount <= value;
        if (!result) {
            Log.warn('Command rejected because voice channel member count exceeds the maximum', {
                memberCount,
                maximum: value,
            });
            await Check.errorSender(i, Embed.vcUserOverLimit(value), true);
        }
        return result;
    }

    static async isValidUUID(i: ChatInputCommandInteraction, sessionId: string) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const result = uuidRegex.test(sessionId);
        if (!result) {
            Log.warn('Command rejected because the session ID format is invalid');
            await Check.errorSender(i, Embed.isValidUUID(), true);
        }
        return result;
    }

    static async errorSender(
        i: ChatInputCommandInteraction,
        payload: EmbedBuilder,
        ephemeral: boolean,
    ) {
        await i.reply({
            embeds: [payload],
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
        });
        Log.success('Sent validation error response');
    }
}

class Embed {
    static userNoConnectVC() {
        return new EmbedBuilder()
            .setTitle('ERROR')
            .setDescription('VCに接続されていません\nVCに接続してから実行してください')
            .setColor(Colors.Red);
    }

    static commandUsedInDM() {
        return new EmbedBuilder()
            .setTitle('ERROR')
            .setDescription('このコマンドはサーバー内でのみ使用できます\nサーバー内で実行してください')
            .setColor(Colors.Red);
    }

    static vcUserUnderLimit(value: number) {
        return new EmbedBuilder()
            .setTitle('ERROR')
            .setDescription(`人数が不正です\nVCに${value}名以上のユーザーが接続していることを確認してください`)
            .setColor(Colors.Red);
    }

    static vcUserOverLimit(value: number) {
        return new EmbedBuilder()
            .setTitle('ERROR')
            .setDescription(`人数が不正です\nVC内が${value}名以下であることを確認してください`)
            .setColor(Colors.Red);
    }

    static isValidUUID() {
        return new EmbedBuilder()
            .setTitle('ERROR')
            .setDescription(
                'Session-IDの形式が正しくありません。\n' +
                    'もう一度、正しいIDを入力してください。\n\n' +
                    '例：下記のような形式です\n' +
                    '```text\n123e4567-e89b-12d3-a456-426614174000\n```',
            )
            .setFooter({
                text: '※このコマンドは /valo team コマンドで発行された Session-ID を使用します',
            })
            .setColor(Colors.Red);
    }
}
