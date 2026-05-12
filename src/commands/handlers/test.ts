import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';

export async function handleTestCommand(i: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setTitle('コピー用コード')
        .setDescription('```js\nconsole.log("Hello, world!");\n```');
    await i.reply({
        embeds: [embed],
    });
}
