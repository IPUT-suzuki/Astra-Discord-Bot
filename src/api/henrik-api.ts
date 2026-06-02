import axios from 'axios';
import { henrikApiErrorConsole, MissingApiKeyError, UserNotFoundError } from './errors.js';
import { API_TIMEOUT_MS, REQUEST_PLATFORMS, REQUEST_REGION } from '../utils/config.js';
import type { RiotUserData } from '../utils/interface.js';
import { Log } from '../utils/log.js';

const apiKey = process.env.HENRIKDEV_API_KEY;

export async function apiGetUserRankData(name: string, tag: string): Promise<RiotUserData> {
    if (!apiKey) {
        throw new MissingApiKeyError();
    }
    try {
        Log.info('checking mmr data existence...');
        Log.info('target', { name, tag });
        const res = await axios.get(getMmrUrl(name, tag), getRequestConfig(apiKey));
        const formatData = formatMmrResponse(res);
        Log.debug('response data', formatData);
        Log.success('mmr data found');
        return formatData;
    } catch (error) {
        if (!axios.isAxiosError(error)) {
            // axios以外の想定外エラーはそのまま再スロー
            Log.error('axios error');
            throw error;
        }
        const status = error.response?.status;
        if (status === 404) {
            //accountチェック
            if (status === 404) {
                Log.warn('mmr data not found');
                Log.info('checking account existence...');
                if (await hasAccount(name, tag)) return formatNoMmrResponse(name, tag);
                UserNotFoundError.console(name, tag, status);
                throw new UserNotFoundError(`${name}#${tag} not found`, 404);
            }
        }
        if (status) {
            const apiError = henrikApiErrorConsole(status, name, tag);
            if (apiError) {
                throw apiError;
            }
        }
        throw error;
    }
}

async function hasAccount(name: string, tag: string) {
    try {
        await axios.get(getAccountUrl(name, tag), getRequestConfig(apiKey as string));
        Log.success('account exists');

        return true;
    } catch (error) {
        if (!axios.isAxiosError(error)) {
            Log.error('axios error');
            throw error;
        }
        const status = error.response?.status;
        if (status === 404) {
            Log.warn('account not found');
            return false;
        }
        Log.error('account check failed');
        if (status) {
            const apiError = henrikApiErrorConsole(status, name, tag);
            if (apiError) {
                throw apiError;
            }
        }
        throw error;
    }
}

function formatMmrResponse(raw: any): RiotUserData {
    const data = (raw as { data: any }).data.data;
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
        name: name,
        tag: tag,
        nowRank: 'Unrated',
        nowRR: '???',
        maxRank: 'Unrated',
    };
}

function getRequestConfig(apiKey: string) {
    return {
        headers: { Authorization: apiKey },
        timeout: API_TIMEOUT_MS,
    };
}

function getMmrUrl(name: string, tag: string) {
    return `https://api.henrikdev.xyz/valorant/v3/mmr/${encodeURIComponent(REQUEST_REGION)}/${encodeURIComponent(REQUEST_PLATFORMS)}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
}

function getAccountUrl(name: string, tag: string) {
    return `https://api.henrikdev.xyz/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
}
