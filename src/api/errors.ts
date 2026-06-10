import { Colors, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { Log } from '../utils/log.js';

// base error for HenrikDev API errors — keeps logging & common fields
class HenrikApiError extends Error {
    status: number;
    constructor(message = 'Henrik API error', status: number) {
        super(message);
        this.name = 'Henrik api error';
        this.status = status;
    }
}

// errors module
export class UserNotFoundError extends HenrikApiError {
    static embed(name: string, tag: string) {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('ERROR')
            .setDescription(name + '#' + tag + 'のアカウント情報が見つかりませんでした');
    }
    static console(name: string, tag: string, status: number) {
        Log.error('Target user was not found by rank service', {
            service: 'rank-service',
            status,
            target: `${name}#${tag}`,
        });
    }
}

class BadRequestError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service request is invalid', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Bad Request')
            .setDescription('リクエストが不正です。入力内容を確認してください。');
    }
}

class UnauthorizedError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service authorization failed', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Unauthorized')
            .setDescription('認証に失敗しました。API キーやアクセス権を確認してください。');
    }
}

class ForbiddenError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service access was forbidden', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Forbidden')
            .setDescription('アクセスが禁止されています。');
    }
}

export class RequestTimeoutError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service request timed out', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle('Timeout')
            .setDescription('リクエストがタイムアウトしました。時間を置いて再試行してください。');
    }
}

class EndpointDeprecatedError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service endpoint is deprecated', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle('Deprecated')
            .setDescription('要求されたエンドポイントは廃止されています。');
    }
}

class RateLimitError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service rate limit was reached', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle('Rate Limited')
            .setDescription('レートリミットに達しました。時間を置いて再試行してください。');
    }
}

class ServerError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service server error occurred', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Server Error')
            .setDescription('サーバーエラーが発生しました。時間を置いて再試行してください。');
    }
}

class NotImplementedError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service does not support the requested feature', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Not Implemented')
            .setDescription('要求された API バージョンはサポートされていません。');
    }
}

class ServiceUnavailableError extends HenrikApiError {
    static console(status: number) {
        Log.error('Rank service is unavailable', {
            service: 'rank-service',
            status,
        });
    }

    static embed() {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Service Unavailable')
            .setDescription('サービスが利用できません。運営側の問題の可能性があります。');
    }
}

export class MissingApiKeyError extends Error {
    constructor(message = 'HENRIKDEV_API_KEY is not set') {
        super(message);
        this.name = 'MissingApiKeyError';
    }
}

export function isAxiosTimeoutError(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    return error.code === 'ECONNABORTED' || error.message.includes('timeout');
}

export function henrikApiErrorConsole(status: number, name: string, tag: string) {
    switch (status) {
        case 400:
            BadRequestError.console(status);
            return new BadRequestError('Bad request', status);
        case 401:
            UnauthorizedError.console(status);
            return new UnauthorizedError('Unauthorized', status);
        case 403:
            ForbiddenError.console(status);
            return new ForbiddenError('Forbidden', status);
        case 404:
            UserNotFoundError.console(name, tag, status);
            return new UserNotFoundError(`${name}#${tag} not found`, status);
        case 408:
            RequestTimeoutError.console(status);
            return new RequestTimeoutError('Request timeout', status);
        case 410:
            EndpointDeprecatedError.console(status);
            return new EndpointDeprecatedError('Endpoint deprecated', status);
        case 429:
            RateLimitError.console(status);
            return new RateLimitError('Rate limit reached', status);
        case 500:
            ServerError.console(status);
            return new ServerError('Server error', status);
        case 501:
            NotImplementedError.console(status);
            return new NotImplementedError('API version not implemented', status);
        case 503:
            ServiceUnavailableError.console(status);
            return new ServiceUnavailableError('Service unavailable', status);
        default:
            break;
    }
}

export function henrikApiErrorEmbed(error: unknown, name: string, tag: string) {
    if (isAxiosTimeoutError(error)) {
        return RequestTimeoutError.embed();
    }

    const status = getErrorStatus(error);

    const handlers: Record<number, () => EmbedBuilder> = {
        400: () => BadRequestError.embed(),
        401: () => UnauthorizedError.embed(),
        403: () => ForbiddenError.embed(),
        404: () => UserNotFoundError.embed(name, tag),
        408: () => RequestTimeoutError.embed(),
        410: () => EndpointDeprecatedError.embed(),
        429: () => RateLimitError.embed(),
        500: () => ServerError.embed(),
        501: () => NotImplementedError.embed(),
        503: () => ServiceUnavailableError.embed(),
    };

    return status && handlers[status]
        ? handlers[status]()
        : new EmbedBuilder()
              .setColor(Colors.Red)
              .setTitle('Error')
              .setDescription('不明なエラーが発生しました。');
}

function getErrorStatus(error: unknown): number | undefined {
    if (typeof error === 'number') return error;
    if (!error || typeof error !== 'object' || !('status' in error)) return undefined;

    const status = error.status;
    return typeof status === 'number' ? status : undefined;
}
