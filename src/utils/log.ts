// src/utils/log.ts
import dayjs from 'dayjs';
import chalk from 'chalk';
import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';
import { DEBUG_MODE } from './config.js';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

interface LogTrace {
    hasError: boolean;
}

export interface LogContext {
    traceId?: string;
    trace?: LogTrace;
}

const levelColor = {
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
    debug: chalk.gray,
} as const;

const contextStorage = new AsyncLocalStorage<LogContext>();
const logDirectory = path.join(process.cwd(), 'logs');

export class Log {
    static withContext<T>(context: LogContext, callback: () => T): T {
        const currentContext = contextStorage.getStore() ?? {};
        const trace = currentContext.trace ?? { hasError: false };
        return contextStorage.run({ ...currentContext, ...context, trace }, callback);
    }

    static hasError(): boolean {
        return contextStorage.getStore()?.trace?.hasError ?? false;
    }

    static getContext(): LogContext {
        const context = contextStorage.getStore();
        return context ? { ...context } : {};
    }

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
        const context = contextStorage.getStore();
        if (level === 'error' && context?.trace) {
            context.trace.hasError = true;
        }

        if (level === 'debug' && !DEBUG_MODE) return;

        const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const label = `[${level.toUpperCase()}]`;
        const coloredLabel = levelColor[level](label);
        const traceId = context?.traceId ?? '-';
        const plainPrefix = `[${time}] ${label} [traceId=${traceId}]`;
        const coloredPrefix = `[${time}] ${coloredLabel} [traceId=${traceId}]`;

        this.writeFile(level, plainPrefix, message, args);

        if (level === 'error') {
            console.error(coloredPrefix, message, ...args);
            return;
        }

        if (level === 'warn') {
            console.warn(coloredPrefix, message, ...args);
            return;
        }

        if (level === 'debug') {
            console.debug(coloredPrefix, message, ...args);
            return;
        }

        console.log(coloredPrefix, message, ...args);
    }

    private static writeFile(
        level: LogLevel,
        prefix: string,
        message: string,
        args: unknown[],
    ): void {
        try {
            const filePath = this.getDailyLogFilePath();
            const details = args.length > 0 ? ' ' + args.map((arg) => this.formatArg(arg)).join(' ') : '';
            appendFileSync(filePath, prefix + ' ' + message + details + '\n', 'utf8');
        } catch (error) {
            if (level !== 'error') {
                console.error('Failed to write log file', error);
            }
        }
    }

    private static getDailyLogFilePath(): string {
        this.ensureLogDirectory();
        return path.join(logDirectory, dayjs().format('YYYY-MM-DD') + '.log');
    }

    private static ensureLogDirectory(): void {
        if (!existsSync(logDirectory)) {
            mkdirSync(logDirectory, { recursive: true });
        }
    }

    private static formatArg(arg: unknown): string {
        if (arg instanceof Error) {
            return arg.stack ?? arg.message;
        }

        if (typeof arg === 'string') return arg;

        return inspect(arg, {
            colors: false,
            depth: 5,
            breakLength: 120,
        });
    }
}
