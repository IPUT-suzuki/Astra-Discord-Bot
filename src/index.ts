//main file
import 'dotenv/config';
import { Client, Events, GatewayIntentBits, type Interaction } from 'discord.js';

import { handleTestCommand } from './commands/handlers/test.js';
import { handleValoRankCommand } from './commands/handlers/rank.js';
import { initTablesInDB } from './database/db.js';
import { registerCommands } from './commands/register.js';
import { handleValoTeamCommand } from './commands/handlers/team.js';
import { handleVcSummonCommand } from './commands/handlers/vc-summon.js';

const token = process.env.TOKEN;
if (!token) {
    console.error('Token is not set. Please set TOKEN in your .env file.');
    process.exit(1);
}
await registerCommands();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.once(Events.ClientReady, (client) => {
    console.log('Bot online : ', client.user.tag);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
        if (interaction.commandName === 'test') {
            await handleTestCommand(interaction);
        } else if (interaction.commandName === 'valo') {
            if (interaction.options.getSubcommand() === 'rank') {
                await handleValoRankCommand(interaction);
            } else if (interaction.options.getSubcommand() === 'map') {
            } else if (interaction.options.getSubcommand() === 'team') {
                await handleValoTeamCommand(interaction);
            } else if (interaction.options.getSubcommand() === 'vc-summon') {
                await handleVcSummonCommand(interaction);
            }
        }
    } catch (error) {
        console.error('Command error : ', error);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('Command failed.');
        } else {
            await interaction.reply({
                content: 'Command failed.',
                ephemeral: true,
            });
        }
    }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // チャンネルから誰かが抜けた場合のみ判定
    const channel = oldState.channel;
    if (
        channel &&
        channel.type === 2 && // VoiceChannel
        channel.members.size === 0 &&
        (channel.name.startsWith('Attacker(自動生成)') ||
            channel.name.startsWith('Defender(自動生成)'))
    ) {
        try {
            await channel.delete('自動生成VCの自動削除');
            console.log(`Deleted empty auto-generated VC: ${channel.name}`);
        } catch (e) {
            console.error('VC自動削除エラー:', e);
        }
    }
});

client.on(Events.Error, (error) => {
    console.error('Discord client error:', error);
});

await initTablesInDB();

await client.login(token);
