// main file
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ChannelType, Client, Events, GatewayIntentBits, type Interaction } from 'discord.js';
import { handleValoRankCommand } from './commands/handlers/rank.js';
import { handleValoTeamCommand } from './commands/handlers/team.js';
import { handleVcSummonCommand } from './commands/handlers/vc-summon.js';
import { initTablesInDB } from './database/db.js';
import { handleValoMapCommand } from './commands/handlers/map.js';
import { Log } from './utils/log.js';

const token = process.env.TOKEN;
if (!token) {
    Log.error('TOKEN is missing; startup aborted');
    process.exit(1);
}
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.once(Events.ClientReady, (client) => {
    Log.success('Bot is ready', { bot: client.user.tag });
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const commandSubName = interaction.options.getSubcommand();
    const traceId = commandName + '-' + commandSubName + '-' + randomUUID().slice(0, 6);

    await Log.withContext({ traceId }, async () => {
        try {
            Log.info('Starting command handling');
            Log.debug('Captured command context', {
                userName: interaction.user.globalName,
                userId: interaction.user.id,
                serverName: interaction.guild?.name,
                serverId: interaction.guild?.id,
            });
            if (commandName === 'valo') {
                if (commandSubName === 'rank') {
                    await handleValoRankCommand(interaction);
                } else if (commandSubName === 'map') {
                    await handleValoMapCommand(interaction);
                } else if (commandSubName === 'team') {
                    await handleValoTeamCommand(interaction);
                } else if (commandSubName === 'vc-summon') {
                    await handleVcSummonCommand(interaction);
                }
            }
            if (Log.hasError()) {
                Log.warn('Completed command handling with logged errors');
            } else {
                Log.success('Completed command handling');
            }
        } catch (error) {
            Log.error('Command handling failed', error);

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply('Command failed.');
                } else {
                    await interaction.reply({
                        content: 'Command failed.',
                        ephemeral: true,
                    });
                }
                Log.success('Sent command failure response');
            } catch (replyError) {
                Log.error('Failed to send command failure response', replyError);
            }
        }
    });
});

client.on(Events.VoiceStateUpdate, async (oldState) => {
    const channel = oldState.channel;
    if (
        channel &&
        channel.type === ChannelType.GuildVoice &&
        channel.members.size === 0 &&
        (channel.name.startsWith('Attacker(自動生成)') ||
            channel.name.startsWith('Defender(自動生成)'))
    ) {
        try {
            Log.info('Starting empty auto voice channel deletion', {
                channelId: channel.id,
                channelName: channel.name,
            });
            await channel.delete('自動生成ボイスチャンネルの自動削除');
            Log.success('Completed empty auto voice channel deletion', {
                channelId: channel.id,
                channelName: channel.name,
            });
        } catch (error) {
            Log.error('Failed to delete empty auto voice channel', error);
        }
    }
});

client.on(Events.Error, (error) => {
    Log.error('Discord client error occurred', error);
});

Log.info('Starting database initialization');
await initTablesInDB();
Log.success('Completed database initialization');

Log.info('Starting Discord login');
await client.login(token);
