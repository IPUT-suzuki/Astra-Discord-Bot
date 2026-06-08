import axios from 'axios';
import type { ValoMapData } from '../utils/interface.js';
import { Log } from '../utils/log.js';

export async function apiGetMapData(): Promise<ValoMapData[]> {
    try {
        Log.info('Starting map service request');
        const res = await axios.get('https://valorant-api.com/v1/maps?language=ja-JP');
        const mapData: ValoMapData[] = res.data.data
            .filter((map: any) => map.tacticalDescription !== null)
            .map((map: any) => ({
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
