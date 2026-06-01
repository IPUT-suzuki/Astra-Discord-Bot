// src/utils/log.ts
import dayjs from 'dayjs';
import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const levelColor = {
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
    debug: chalk.gray,
} as const;

export class Log {
    static info(message: string, ...args: unknown[]): void {
        this.write('info', message, ...args);
    }

    static success(message: string, ...args: unknown[]): void {
        this.write('success', message, ...args);
    }

    static warn(message: string, ...args: unknown[]): void {
        this.write('warn', message, ...args);
    }

    static error(message: string, ...args: unknown[]): void {
        this.write('error', message, ...args);
    }

    static debug(message: string, ...args: unknown[]): void {
        this.write('debug', message, ...args);
    }

    private static write(level: LogLevel, message: string, ...args: unknown[]): void {
        const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const coloredLevel = levelColor[level](`[${level.toUpperCase()}]`);
        const prefix = `[${time}] ${coloredLevel}`;

        if (level === 'error') {
            console.error(prefix, message, ...args);
            return;
        }

        if (level === 'warn') {
            console.warn(prefix, message, ...args);
            return;
        }

        if (level === 'debug') {
            console.debug(prefix, message, ...args);
            return;
        }

        console.log(prefix, message, ...args);
    }
}
