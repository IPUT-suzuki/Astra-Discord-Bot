import { Colors, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ValoMapData } from '../../utils/interface.js';
import { apiGetMapData } from '../../api/valorant-api.js';
import { Log } from '../../utils/log.js';

export async function handleValoMapCommand(i: ChatInputCommandInteraction) {
    try {
        Log.info('Starting map candidate fetch');
        const mapPool: ValoMapData[] = await apiGetMapData();
        const randomMap = mapPool[Math.floor(Math.random() * mapPool.length)];
        if (!randomMap) {
            throw new Error('抽選可能なマップがありません');
        }
        Log.info('Selecting random map', { candidateCount: mapPool.length });
        await i.reply({ embeds: [Embed.mapEmbed(randomMap)] });
        Log.success('Sent map selection response', { selectedMap: randomMap.name });
    } catch (error) {
        Log.error('Map selection failed', error);
        throw error;
    }
}

class Embed {
    static mapEmbed(mapData: ValoMapData) {
        return new EmbedBuilder()
            .setTitle('マップ抽選結果')
            .setColor(Colors.Green)
            .setFields({ name: mapData.name, value: '' })
            .setImage(mapData.image.footer)
            .setThumbnail(mapData.image.displayIcon);
    }
}
