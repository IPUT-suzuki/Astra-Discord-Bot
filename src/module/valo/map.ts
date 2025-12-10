import { Colors, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { mapInfo } from '../../utils/valoconfig.js';
import type { slashValoMapData, MapInfo } from '../../utils/interface.js';
import { Log } from '../../utils/logger.js';

export class ValoMap {
    i: ChatInputCommandInteraction;
    data: slashValoMapData;
    mapinfo: MapInfo[];
    constructor(interaction: ChatInputCommandInteraction) {
        this.i = interaction;
        this.data = {
            option: interaction.options.getString('option', true),
            map: '',
            mapImage: '',
            miniMapImage: '',
        };
        this.mapinfo = mapInfo;
    }

    async start() {
        if (this.data.option === 'all') {
            //何もしない
        } else if (this.data.option === 'competitive') {
            this.setCompetitiveMap();
        }
        this.randomMapSelector();
        const embed = Embed.result(this.data);
        Log.debug(JSON.stringify(this.data, null, 2));
        await this.i.reply({
            embeds: [embed],
        });
    }

    setCompetitiveMap() {
        this.mapinfo = this.mapinfo.filter((map) => map.competitive === true);
    }

    randomMapSelector() {
        const num = Math.floor(Math.random() * this.mapinfo.length);
        this.data = {
            option: this.data.option,
            map: this.mapinfo[num]?.name ?? '',
            mapImage: this.mapinfo[num]?.mapImage ?? '',
            miniMapImage: this.mapinfo[num]?.miniMapImage ?? '',
        };
    }
}

class Embed {
    static result(data: slashValoMapData) {
        return new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(`マップ抽選結果`)
            .setFields([{ name: `マップ名 : ${data.map}`, value: '', inline: true }])
            .setImage(data.mapImage)
            .setThumbnail(data.miniMapImage)
            .setFooter({ text: `Select command option : ${data.option}` });
    }
}

class Button {}
