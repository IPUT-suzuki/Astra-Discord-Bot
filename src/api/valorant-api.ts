import axios from 'axios';
import type { ValoMapData } from '../utils/interface.js';
import { Log } from '../utils/log.js';

interface ValorantMapResponse {
    data: ValorantMapResponseData[];
}

interface ValorantMapResponseData {
    displayName: string;
    tacticalDescription: string | null;
    listViewIconTall: string;
    displayIcon: string;
}

export async function apiGetMapData(): Promise<ValoMapData[]> {
    try {
        Log.info('Starting map service request');
        const res = await axios.get<ValorantMapResponse>('https://valorant-api.com/v1/maps?language=ja-JP');
        const mapData: ValoMapData[] = res.data.data
            .filter((map) => map.tacticalDescription !== null)
            .map((map) => ({
                name: map.displayName,
                image: {
                    footer: map.listViewIconTall,
                    displayIcon: map.displayIcon,
                },
            }));
        Log.success('Completed map service data fetch', {
            mapCount: mapData.length,
            status: res.status,
        });
        return mapData;
    } catch (error) {
        Log.error('Failed to fetch map service data', error);
        throw error;
    }
}
