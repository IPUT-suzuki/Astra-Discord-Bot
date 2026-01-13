import 'dotenv/config';
import { Client, IntentsBitField } from 'discord.js';
import type { Interaction } from 'discord.js';
import { Log } from './utils/logger.js';
import { Dice } from './module/dice.js';
import { ValoMap } from './module/valo/map.js';
import { initTablesInDB } from './database/db.js';
import { ValoRank } from './module/valo/rank.js';
import { ValoTeam } from './module/valo/team.js';

const args = process.argv.slice(2);
export const isDebug = args.includes('debug');
if (isDebug) {
    Log.main('Boot is debug mode');
}
await initTablesInDB(); //データベースの初期化

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

client.on('interactionCreate', (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    // 並列で非同期処理
    (async () => {
        const command = interaction.commandName;
        const subCommand = interaction.options.getSubcommand(false);
        const fullcommand = subCommand ? command + ' ' + subCommand : command;
        Log.useCommand(interaction);
        if (fullcommand == 'valo rank') {
            const valorank = new ValoRank(interaction);
            await valorank.start();
            Log.commandSuccess(interaction);
        } else if (fullcommand == 'valo team') {
            const valoteam = new ValoTeam(interaction);
            await valoteam.start();
            Log.commandSuccess(interaction);
        } else if (fullcommand == 'valo map') {
            const valomap = new ValoMap(interaction);
            await valomap.start();
            Log.commandSuccess(interaction);
        } else if (fullcommand == 'valo list') {
        } else if (fullcommand == 'dice') {
            const dice = new Dice(interaction);
            await dice.start();
            Log.commandSuccess(interaction);
        }
    })();
});
