import type { Message, MessageComponentInteraction } from 'discord.js';

export async function listener(
    reply: Message,
    prefix: string,
    time: number | null = null
): Promise<MessageComponentInteraction | void> {
    return new Promise((resolve) => {
        const collector = reply.createMessageComponentCollector({ time: time ?? 600_000 }); //デフォルト10分
        collector.on('collect', async (btnInteraction) => {
            const btnId = btnInteraction.customId;
            if (btnId.startsWith(prefix)) {
                await btnInteraction.deferUpdate();
                resolve(btnInteraction);
                collector.stop();
            }
        });
        collector.on('end', () => {
            resolve();
        });
    });
}
