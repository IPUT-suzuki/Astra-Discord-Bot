import axios from 'axios';
import type { RiotUserData } from '../utils/interface.js';
import { ApiRequestError, MissingApiKeyError, UserNotFoundError } from './errors.js';
import { API_TIMEOUT_MS, REQUEST_PLATFORMS, REQUEST_REGION } from '../utils/config.js';

export async function apiGetUserRankData(name: string, tag: string): Promise<RiotUserData> {
    const apiKey = process.env.HENRIKDEV_API_KEY;
    if (!apiKey) {
        throw new MissingApiKeyError();
    }
    try {
        const res = await axios.get(getMmrUrl(name, tag), getRequestConfig(apiKey));
        return formatMmrResponse(res);
    } catch (error) {
        if (!axios.isAxiosError(error)) {
            throw error;
        }
        const status = error.response?.status;
        if (status !== 404) throw new ApiRequestError();
        try {
            await axios.get(getAccountUrl(name, tag), getRequestConfig(apiKey));
            return formatNoMmrResponse(name, tag);
        } catch (e) {
            throw new UserNotFoundError();
        }
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
