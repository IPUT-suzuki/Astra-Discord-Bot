import {
    Colors,
    EmbedBuilder,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type Message,
    type MessageComponentInteraction,
    type StringSelectMenuInteraction,
} from 'discord.js';
import { Log } from '../../../utils/logger.js';

export async function listener(
    reply: Message,
    prefix: string,
    interaction: any, // ChatInputCommandInteractionなど
    time?: number | null
): Promise<MessageComponentInteraction | StringSelectMenuInteraction | ButtonInteraction | null> {
    return new Promise((resolve, reject) => {
        const collector = reply.createMessageComponentCollector({ time: time ?? 600_000 });

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.customId.startsWith(prefix)) {
                resolve(btnInteraction);
                collector.stop();
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && interaction) {
                await sendTimeOutEmbed(interaction);
                reject(new Error('タイムアウトにより処理を中断'));
            } else {
                resolve(null);
            }
        });
    });
}

async function sendTimeOutEmbed(interaction: ChatInputCommandInteraction) {
    await interaction.editReply({
        embeds: [timeoutEmbed()],
        components: [],
    });
}

function timeoutEmbed(): EmbedBuilder {
    Log.error('Command time out');
    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('TIMEOUT')
        .setDescription('一定時間操作が行われなかった為プロセスを強制終了しました');
}
