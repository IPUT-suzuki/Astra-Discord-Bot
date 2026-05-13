import axios from 'axios';
import type { ValoMapData } from '../utils/interface.js';

export async function apiGetMapData(): Promise<ValoMapData[]> {
    try {
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
        return mapData;
    } catch (error) {
        throw error;
    }
}
