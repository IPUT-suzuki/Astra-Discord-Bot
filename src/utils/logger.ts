import fs from 'fs';
import { isDebug } from '../index.js';
import chalk from 'chalk';
import type { ChatInputCommandInteraction } from 'discord.js';

export class Log {
    static writeToFile(message: string) {
        fs.appendFileSync('app.log', message + '\n');
    }
    static timeStamp() {
        return new Date().toISOString();
    }

    static main(message: string) {
        const text = `[${this.timeStamp()}]` + '[MAIN]' + `${message}`;
        console.log(chalk.white(text));
        this.writeToFile(text);
    }
    static info(message: string) {
        const text = `[${this.timeStamp()}]` + '[INFO]' + `${message}`;
        console.log(chalk.blue(text));
        this.writeToFile(text);
    }
    static success(message: string) {
        const text = `[${this.timeStamp()}]` + '[SUCCESS]' + `${message}`;
        console.log(chalk.green(text));
        this.writeToFile(text);
    }
    static error(message: string) {
        const text = `[${this.timeStamp()}]` + '[ERROR]' + `${message}`;
        console.log(chalk.red(text));
        this.writeToFile(text);
    }
    static debug(message: string) {
        if (isDebug) {
            const text = `[${this.timeStamp()}]` + '[DEBUG]' + `${message}`;
            console.log(chalk.yellow(text));
            this.writeToFile(text);
        }
    }

    static useCommand(interaction: ChatInputCommandInteraction) {
        const command = interaction.commandName;
        const subCommand = interaction.options.getSubcommand(false);
        const fullcommand = subCommand ? command + ' ' + subCommand : command;
        this.main(`Command: ${fullcommand}`);
        this.info(
            `Guild: ${interaction.guild ? interaction.guild.name : 'None'} (${
                interaction.guild ? interaction.guild.id : 'None'
            })`
        );
        this.info(`User: ${interaction.user.username} (${interaction.user.id})`);
        this.info(`Interaction ID: ${interaction.id}`);
        this.debug(`Interaction TOKEN: ${interaction.token}`);
    }
    static commandSuccess(interaction: ChatInputCommandInteraction) {
        const command = interaction.commandName;
        const subCommand = interaction.options.getSubcommand(false);
        const fullcommand = subCommand ? command + ' ' + subCommand : command;
        this.success(`Command: ${fullcommand}`);
        this.info(`Interaction ID: ${interaction.id}`);
        this.debug(`Interaction TOKEN: ${interaction.token}`);
    }
}
