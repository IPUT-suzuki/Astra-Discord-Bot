import type { ButtonInteraction, Message, MessageComponentInteraction, StringSelectMenuInteraction } from 'discord.js';
import { timeoutEmbed, sendTimeOutEmbed } from './timeout.js';

export async function listener(
    reply: Message,
    prefix: string,
    interaction: any, // ChatInputCommandInteractionなど
    time?: number | null
): Promise<MessageComponentInteraction | StringSelectMenuInteraction | ButtonInteraction | null> {
    return new Promise((resolve, reject) => {
        const collector = reply.createMessageComponentCollector({ time: time ?? 6_000 });

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
