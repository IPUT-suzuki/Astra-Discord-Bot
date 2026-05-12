import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandDefinitions } from './definitions.js';

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

    //delete global command
    await rest.put(route, { body: [] });
    console.log('Deleted all global commands');

    //register global command
    await rest.put(route, { body: commandDefinitions });
    console.log('Registered global commands');
}
