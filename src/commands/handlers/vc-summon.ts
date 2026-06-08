import {
    Colors,
    EmbedBuilder,
    MessageFlags,
    type ChatInputCommandInteraction,
    type GuildMember,
    type VoiceChannel,
} from 'discord.js';
import { Check } from './common/check.js';
import { Log } from '../../utils/log.js';

export async function handleVcSummonCommand(i: ChatInputCommandInteraction) {
    Log.info('Starting voice channel summon precheck');
    if (!(await Check.isCommandChannel(i))) return;
    if (!(await Check.isUserVcState(i))) return;

    const sessionId = i.options.getString('session_id', true);
    if (!(await Check.isValidUUID(i, sessionId))) return;

    Log.info('Searching voice channels for session ID', { sessionId: sessionId });
    const guild = i.guild;
    const targetVCs = guild?.channels.cache.filter(
        (channel) => channel.type === 2 && channel.name.includes(sessionId),
    );
    if (!targetVCs?.size) {
        Log.warn('Voice channel summon aborted because no channel matched the session ID', {
            sessionId: sessionId,
        });
        await i.reply({ embeds: [Embed.noVoiceChannel(sessionId)], flags: MessageFlags.Ephemeral });
        return;
    }

    const userVC = (i.member as GuildMember)?.voice?.channel;
    const movePromises: Promise<unknown>[] = [];
    for (const vc of targetVCs.values()) {
        for (const member of (vc as VoiceChannel).members.values()) {
            movePromises.push(member.voice.setChannel(userVC));
        }
    }

    Log.info('Starting target user voice channel move', {
        targetChannelCount: targetVCs.size,
        targetUserCount: movePromises.length,
    });
    await Promise.all(movePromises);
    Log.success('Completed target user voice channel move', { movedUserCount: movePromises.length });
    await i.reply({ embeds: [Embed.successMoveVc()] });
    Log.success('Sent voice channel summon response');
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
