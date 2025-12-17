import type { ButtonInteraction, Message, MessageComponentInteraction, StringSelectMenuInteraction } from 'discord.js';
import { timeoutEmbed } from './timeout.js';

export async function listener(
    reply: Message,
    prefix: string,
    time?: number | null
): Promise<MessageComponentInteraction | StringSelectMenuInteraction | ButtonInteraction | null> {
    return new Promise((resolve) => {
        const collector = reply.createMessageComponentCollector({ time: time ?? 600_000 }); //デフォルト10分

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.customId.startsWith(prefix)) {
                resolve(btnInteraction);
                collector.stop();
            }
        });

        collector.on('end', () => {
            resolve(null);
        });
    });
}
