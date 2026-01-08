import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    MessageComponentInteraction,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { mapInfo } from '../../utils/valoconfig.js';
import type { slashValoMapData, MapInfo } from '../../utils/interface.js';
import { Log } from '../../utils/logger.js';
import { listener } from './common/listener.js';
import { timeoutEmbed } from './common/timeout.js';

export class ValoMap {
    i: ChatInputCommandInteraction;
    data: slashValoMapData;
    mapinfo: MapInfo[];
    excludeConfirm: boolean;
    constructor(interaction: ChatInputCommandInteraction) {
        this.i = interaction;
        this.data = { option: interaction.options.getString('option', true) };

        this.mapinfo = mapInfo.map((map) => ({
            ...map,
            selected: false,
        }));
        this.excludeConfirm = false;
    }

    async start() {
        if (this.data.option === 'all') {
            await this.sendResult(true);
        } else if (this.data.option === 'competitive') {
            this.setCompetitiveMap();
            await this.sendResult(true);
        } else if (this.data.option === 'exclude') {
            let isFirst = true;
            while (!this.excludeConfirm) {
                if (isFirst) {
                    await this.sendExcludeOption();
                }
                isFirst = false;
                const newInteraction = await listener(await this.i.fetchReply(), 'exclude_', this.i);
                if (!newInteraction) {
                    await this.i.editReply({
                        embeds: [timeoutEmbed()],
                        components: [],
                    });
                    return;
                }
                if (newInteraction?.customId === 'exclude_confirm') {
                    this.excludeConfirm = true;
                } else if (newInteraction?.customId?.startsWith('exclude_')) {
                    const mapName = newInteraction.customId.replace('exclude_', '');
                    const target = this.mapinfo.find((map) => map.name === mapName);
                    if (target) {
                        target.selected = !target.selected;
                        Log.info(`Map "${target.name}" excluded state: ${target.selected ? 'true' : 'false'}`);
                        Log.info(`Interaction ID: ${this.i.id}`);
                    }
                }
                this.sendExcludeOption(newInteraction ?? null);
            }
            this.setExcludeMap();
            Log.debug(JSON.stringify(this.mapinfo, null, 2));
            await this.sendResult(isFirst);
        }
    }

    async sendExcludeOption(btnInteraction?: MessageComponentInteraction | null) {
        const embeds = [Embed.excludeInfo(this.mapinfo)];
        const components = [
            ...Button.excluedeButton(this.mapinfo),
            new ActionRowBuilder<ButtonBuilder>().addComponents(Button.confirmButton()),
        ];
        if (btnInteraction) {
            await btnInteraction.update({ embeds, components });
        } else {
            await this.i.reply({ embeds, components });
        }
    }
    async sendResult(isFirst: boolean) {
        this.randomMapSelector();
        Log.debug(JSON.stringify(this.data, null, 2));
        const method = isFirst ? 'reply' : 'editReply';
        await this.i[method]({
            embeds: [Embed.result(this.data)],
            components: [],
        });
    }

    setCompetitiveMap() {
        this.mapinfo = this.mapinfo.filter((map) => map.competitive === true);
    }
    setExcludeMap() {
        this.mapinfo = this.mapinfo.filter((map) => map.selected === false);
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
            .setImage(data.mapImage ?? '')
            .setThumbnail(data.miniMapImage ?? '')
            .setFooter({ text: `Select command option : ${data.option}` });
    }
    static excludeInfo(data: MapInfo[]) {
        const field = data.map((map) => ({
            name: (map.selected ? ':red_circle:' : ':blue_circle:') + ' ' + map.name,
            value: '',
            inline: true,
        }));
        return new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('除外するマップを選択してください')
            .setFields(field)
            .setFooter({ text: '🔵 -- 未除外\n🔴 -- 除外済み' });
    }
}

class Button {
    static excluedeButton(data: MapInfo[]) {
        const unselectedCount = data.filter((map) => !map.selected).length;
        const buttons: ButtonBuilder[] = data.map((map) => {
            if (!map.selected && unselectedCount === 1) {
                return new ButtonBuilder()
                    .setCustomId(`exclude_${map.name}`)
                    .setLabel(map.name ?? '')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);
            }
            // 通常のボタン
            return new ButtonBuilder()
                .setCustomId(`exclude_${map.name}`)
                .setLabel(map.name ?? '')
                .setStyle(map.selected ? ButtonStyle.Danger : ButtonStyle.Primary);
        });

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        for (let i = 0; i < buttons.length; i += 4) {
            rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 4)));
        }
        return rows;
    }
    static confirmButton() {
        return new ButtonBuilder().setCustomId('exclude_confirm').setLabel('確定').setStyle(ButtonStyle.Success);
    }
}
