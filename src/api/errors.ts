import { Colors, EmbedBuilder } from 'discord.js';

// errors module
export class UserNotFoundError extends Error {
    constructor(message = 'User not found') {
        super(message);
        this.name = 'UserNotFoundError';
    }

    static embed(name: string, tag: string) {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('ERROR')
            .setDescription(name + '#' + tag + 'のアカウント情報が見つかりませんでした');
    }
}

export class ApiRequestError extends Error {
    status?: number;
    constructor(message = 'API request failed', status?: number) {
        super(message);
        this.name = 'ApiRequestError';
        if (status !== undefined) {
            this.status = status;
        }
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('ERROR')
            .setDescription('APIリクエストエラー\n時間を空けてから再度実行してください');
    }
}

export class MissingApiKeyError extends Error {
    constructor(message = 'HENRIKDEV_API_KEY is not set') {
        super(message);
        this.name = 'MissingApiKeyError';
    }
}
