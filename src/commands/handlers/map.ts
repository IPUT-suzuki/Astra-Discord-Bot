import { Colors, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ValoMapData } from '../../utils/interface.js';
import { apiGetMapData } from '../../api/valorant-api.js';

export async function handleValoMapCommand(i: ChatInputCommandInteraction) {
    try {
        const mapPool: ValoMapData[] = await apiGetMapData();
        const randomMap = mapPool[Math.floor(Math.random() * mapPool.length)];
        i.reply({ embeds: [Embed.mapEmbed(randomMap!)] });
    } catch (error) {
        console.log(error);
    }
    return;
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
