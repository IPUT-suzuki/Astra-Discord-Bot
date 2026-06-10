import axios from 'axios';
import {
    henrikApiErrorConsole,
    isAxiosTimeoutError,
    MissingApiKeyError,
    RequestTimeoutError,
    UserNotFoundError,
} from './errors.js';
import { API_TIMEOUT_MS, REQUEST_PLATFORMS, REQUEST_REGION } from '../utils/config.js';
import type { RiotUserData } from '../utils/interface.js';
import { Log } from '../utils/log.js';

interface HenrikMmrResponse {
    data: {
        account: {
            name: string;
            tag: string;
        };
        current: {
            tier: {
                name: string;
            };
            rr: number;
        };
        peak: {
            tier: {
                name: string;
            };
        };
    };
}

const apiKey = process.env.HENRIKDEV_API_KEY;

export async function apiGetUserRankData(name: string, tag: string): Promise<RiotUserData> {
    const target = `${name}#${tag}`;
    if (!apiKey) {
        Log.error('Rank service credential is missing');
        throw new MissingApiKeyError();
    }

    try {
        Log.info('Starting rank service MMR fetch', { target });
        const res = await axios.get<HenrikMmrResponse>(getMmrUrl(name, tag), getRequestConfig(apiKey));
        const formatData = formatMmrResponse(res.data);
        Log.success('Completed rank service MMR fetch', {
            target,
            status: res.status,
        });
        return formatData;
    } catch (error) {
        if (!axios.isAxiosError(error)) {
            Log.error('Unexpected error occurred while fetching rank data', { target, error });
            throw error;
        }

        if (isAxiosTimeoutError(error)) {
            RequestTimeoutError.console(408);
            throw new RequestTimeoutError('Request timeout', 408);
        }

        const status = error.response?.status;
        Log.warn('Rank service MMR fetch failed', { target, status });
        if (status === 404) {
            Log.info('Starting account existence check because MMR data was not found', { target });
            if (await hasAccount(name, tag)) {
                Log.info('Creating unrated rank data', { target });
                return formatNoMmrResponse(name, tag);
            }
            UserNotFoundError.console(name, tag, status);
            throw new UserNotFoundError(`${name}#${tag} not found`, 404);
        }
        if (status) {
            const apiError = henrikApiErrorConsole(status, name, tag);
            if (apiError) throw apiError;
        }
        throw error;
    }
}

async function hasAccount(name: string, tag: string) {
    const target = `${name}#${tag}`;
    try {
        const res = await axios.get(getAccountUrl(name, tag), getRequestConfig(apiKey as string));
        Log.success('Confirmed account existence with rank service', {
            target,
            status: res.status,
        });
        return true;
    } catch (error) {
        if (!axios.isAxiosError(error)) {
            Log.error('Unexpected error occurred while checking account existence', { target, error });
            throw error;
        }
        const status = error.response?.status;
        if (status === 404) {
            Log.warn('Target account was not found by rank service', { target, status });
            return false;
        }
        Log.error('Rank service account check failed', { target, status });
        if (status) {
            const apiError = henrikApiErrorConsole(status, name, tag);
            if (apiError) throw apiError;
        }
        throw error;
    }
}

function formatMmrResponse(raw: HenrikMmrResponse): RiotUserData {
    const data = raw.data;
    return {
        name: data.account.name,
        tag: data.account.tag,
        nowRank: data.current.tier.name,
        nowRR: String(data.current.rr),
        maxRank: data.peak.tier.name,
    };
}

function formatNoMmrResponse(name: string, tag: string): RiotUserData {
    return {
        name,
        tag,
        nowRank: 'Unrated',
        nowRR: '???',
        maxRank: 'Unrated',
    };
}

function getRequestConfig(key: string) {
    return {
        headers: { Authorization: key },
        timeout: API_TIMEOUT_MS,
    };
}

function getMmrUrl(name: string, tag: string) {
    return `https://api.henrikdev.xyz/valorant/v3/mmr/${encodeURIComponent(REQUEST_REGION)}/${encodeURIComponent(REQUEST_PLATFORMS)}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
}

function getAccountUrl(name: string, tag: string) {
    return `https://api.henrikdev.xyz/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
}
