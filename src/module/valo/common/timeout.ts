import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    StringSelectMenuInteraction,
    type Interaction,
} from 'discord.js';
import { Log } from '../../../utils/logger.js';

export function timeoutEmbed(): EmbedBuilder {
    Log.error('Command time out');
    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('TIMEOUT')
        .setDescription('一定時間操作が行われなかった為プロセスを強制終了しました');
}

export async function sendTimeOutEmbed(interaction: ChatInputCommandInteraction) {
    await interaction.editReply({
        embeds: [timeoutEmbed()],
        components: [],
    });
}
