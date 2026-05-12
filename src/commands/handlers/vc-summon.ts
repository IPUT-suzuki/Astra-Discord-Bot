import {
    Colors,
    EmbedBuilder,
    MessageFlags,
    type ChatInputCommandInteraction,
    type GuildMember,
    type VoiceChannel,
} from 'discord.js';
import { Check } from './common/check.js';

export async function handleVcSummonCommand(i: ChatInputCommandInteraction) {
    if (!(await Check.isCommandChannel(i))) return;
    if (!(await Check.isUserVcState(i))) return;
    const sessionId = i.options.getString('session_id', true);
    if (!(await Check.isValidUUID(i, sessionId))) return;
    const guild = i.guild;
    const targetVCs = guild?.channels.cache.filter(
        (ch) => ch.type === 2 && ch.name.includes(sessionId),
    );
    if (!targetVCs?.size) {
        await i.reply({ embeds: [Embed.noVoiceChannel(sessionId)], flags: MessageFlags.Ephemeral });
        return;
    }
    const userVC = (i.member as GuildMember)?.voice?.channel;
    const movePromises: Promise<any>[] = [];
    for (const vc of targetVCs.values()) {
        for (const member of (vc as VoiceChannel).members.values()) {
            movePromises.push(member.voice.setChannel(userVC));
        }
    }
    await Promise.all(movePromises);
    await i.reply({ embeds: [Embed.successMoveVc()] });
}

class Embed {
    static noVoiceChannel(id: string) {
        return new EmbedBuilder()
            .setTitle('ERROR')
            .setDescription(
                'Session-IDを含むボイスチャンネルが見つかりませんでした\n入力に間違いが無いか確認してください',
            )
            .addFields({
                name: '入力されたSession-ID',
                value: `\`\`\`text\n${id}\n\`\`\``,
            })
            .setColor(Colors.Red);
    }
    static successMoveVc() {
        return new EmbedBuilder().setTitle('VCの移動が正常に完了しました').setColor(Colors.Green);
    }
}
