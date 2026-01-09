import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type GuildMember,
} from 'discord.js';
import type { DiscordUserData, ValoMapData } from '../../utils/interface.js';
import { mapInfo } from '../../utils/valoconfig.js';
import { listener } from './common/listener.js';

export class ValoMap {
    interaction: ChatInputCommandInteraction | ButtonInteraction;
    selectOption: string;
    user: DiscordUserData;
    mapPool: ValoMapData[];
    constructor(interaction: ChatInputCommandInteraction) {
        this.interaction = interaction;
        this.selectOption = this.interaction.options.getString('option', true);
        this.user = {
            userName: (interaction.member as GuildMember)?.displayName ?? interaction.user.username,
            userId: interaction.user.id,
            userIcon: interaction.user.displayAvatarURL(),
        };
        this.mapPool = mapInfo;
    }

    async start() {
        const selectOption = (this.interaction as ChatInputCommandInteraction).options.getString('option', true);
        //selectOptionがallの場合は無視
        if (selectOption === 'competitive') {
            this.mapPool = this.mapPool.filter((map) => map.competitive);
        } else if (selectOption === 'exclude') {
            try {
                await this.mapExcludeStep();
            } catch {
                return;
            }
        }
        await this.sendResult();
    }

    private async sendResult() {
        const selectMap = this.mapPool[Math.floor(Math.random() * this.mapPool.length)];
        if (this.interaction.isButton()) {
            await this.interaction.update({
                embeds: [Embed.mapResult(selectMap!, this.selectOption)],
                components: [],
            });
        } else {
            await this.interaction.reply({
                embeds: [Embed.mapResult(selectMap!, this.selectOption)],
            });
        }
    }

    private async mapExcludeStep() {
        while (true) {
            const payload = {
                embeds: [Embed.excludeInfo(this.mapPool)],
                components: [...Button.mapButton(this.mapPool), Button.confirmButton()],
            };
            if (this.interaction.isButton()) {
                await this.interaction.update(payload);
            } else {
                await this.interaction.reply(payload);
            }
            const reply = await this.interaction.fetchReply();
            this.interaction = (await listener(reply, 'on_', this.interaction)) as ButtonInteraction;
            if (this.interaction.customId.endsWith('confirm')) {
                break;
            } else if (this.interaction.customId.includes('_exclude_')) {
                const mapName = this.interaction.customId.replace('on_exclude_', '');
                this.mapPool = this.mapPool.filter((map) => map.mapName !== mapName);
            } else if (this.interaction.customId.includes('_include_')) {
                const mapName = this.interaction.customId.replace('on_include_', '');
                this.mapPool.push(mapInfo.find((map) => map.mapName === mapName)!);
            }
        }
    }
}

class Embed {
    static mapResult(map: ValoMapData, option: string) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('マップ抽選結果')
            .setFields([{ name: `マップ名 : ${map.mapName}`, value: '', inline: true }])
            .setImage(map.mapImage ?? '')
            .setThumbnail(map.miniMapImage ?? '')
            .setFooter({ text: `Select command option : ${option}` });
        return embed;
    }

    static excludeInfo(mapPool: ValoMapData[]) {
        const fields = mapInfo.map((map) => ({
            name: `${mapPool.includes(map!) ? ':blue_circle:' : ':red_circle:'} ${map?.mapName}`,
            value: '',
            inline: true,
        }));
        return new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('除外するマップを選択してください')
            .setFields(fields)
            .setFooter({ text: '🔵 -- 未除外\n🔴 -- 除外済み' });
    }
}

class Button {
    static mapButton(mapPool: ValoMapData[]) {
        const buttons: ButtonBuilder[] = mapInfo.map((map) => {
            if (mapPool.length === 1 && mapPool.includes(map)) {
                return new ButtonBuilder()
                    .setCustomId('no_select')
                    .setLabel(map.mapName)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);
            }
            const isIncludes = mapPool.includes(map);
            return new ButtonBuilder()
                .setCustomId(isIncludes ? `on_exclude_${map.mapName}` : `on_include_${map.mapName}`)
                .setLabel(map.mapName)
                .setStyle(isIncludes ? ButtonStyle.Primary : ButtonStyle.Danger);
        });
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        for (let i = 0; i < buttons.length; i += 3) {
            rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 3)));
        }
        return rows;
    }

    static confirmButton() {
        const button = new ButtonBuilder().setCustomId('on_confirm').setLabel('確定').setStyle(ButtonStyle.Success);
        return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    }
}
