import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandDefinitions } from './definitions.js';
import { Log } from '../utils/log.js';

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
    throw new Error('TOKEN is not set. Please set TOKEN in your .env file.');
}
if (!clientId) {
    throw new Error('CLIENT_ID is not set. Please set CLIENT_ID in your .env file.');
}

const rest = new REST({ version: '10' }).setToken(token);

export async function registerCommands() {
    const route = Routes.applicationCommands(clientId!);

    try {
        Log.info('Starting global command deletion');
        await rest.put(route, { body: [] });
        Log.success('Completed global command deletion');

        Log.info('Starting global command registration', {
            commandCount: commandDefinitions.length,
        });
        await rest.put(route, { body: commandDefinitions });
        Log.success('Completed global command registration', {
            commandCount: commandDefinitions.length,
        });
    } catch (error) {
        Log.error('Failed to update global commands', error);
        throw error;
    }
}
