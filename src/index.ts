import 'dotenv/config';
import { Client, IntentsBitField } from 'discord.js';
import type { Interaction } from 'discord.js';
import { Log } from './utils/logger.js';
import { Dice } from './module/dice.js';

const args = process.argv.slice(2);
export const isDebug = args.includes('debug');
if (isDebug) {
    Log.main('Boot is debug mode');
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
    ],
});

client.login(process.env.TOKEN);

client.on('clientReady', async (c) => {
    Log.main(c.user.tag + 'is Online');
});

client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    // ここから下はinteraction: ChatInputCommandInteractionとして扱える
    const command = interaction.commandName;
    const subCommand = interaction.options.getSubcommand(false);
    const fullcommand = subCommand ? command + ' ' + subCommand : command;
    Log.useCommand(interaction);
    if (fullcommand == 'valo rank') {
    } else if (fullcommand == 'valo team') {
    } else if (fullcommand == 'valo map') {
    } else if (fullcommand == 'valo list') {
    } else if (fullcommand == 'dice') {
        const dice = new Dice(interaction);
        await dice.start();
        Log.commandSuccess(interaction);
    }
});
