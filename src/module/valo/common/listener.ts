import type { Message, MessageComponentInteraction } from 'discord.js';

export async function listener(
    reply: Message,
    prefix: string,
    time: number | null = null
): Promise<MessageComponentInteraction | void> {
    return new Promise((resolve) => {
        const collector = reply.createMessageComponentCollector({ time: time ?? 600_000 }); //デフォルト10分
        collector.on('collect', async (btnInteraction) => {
            await btnInteraction.deferUpdate();
            const btnId = btnInteraction.customId;
            if (btnId.startsWith(prefix)) {
                resolve(btnInteraction);
                collector.stop();
            }
        });
        collector.on('end', () => {
            resolve();
        });
    });
}
