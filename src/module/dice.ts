import type { ChatInputCommandInteraction } from 'discord.js';
import { Colors, EmbedBuilder } from 'discord.js';
import { Log } from '../utils/logger.js';
interface diceData {
    name: string;
    icon: string;
    value: number;
}

export class Dice {
    i: ChatInputCommandInteraction;
    data: diceData;
    constructor(interaction: ChatInputCommandInteraction) {
        this.i = interaction;
        this.data = {
            name: this.i.user.tag,
            icon: this.i.user.displayAvatarURL(),
            value: Math.floor(Math.random() * 100) + 1,
        };
        Log.debug(JSON.stringify(this.data, null, 2));
    }
    async start() {
        const embed = Embed.result(this.data);
        await this.i.reply({
            embeds: [embed],
        });
    }
}

class Embed {
    static result(data: diceData) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: data.name, iconURL: data.icon })
            .setTitle(`ダイス結果 : ${data.value}`)
            .setColor(Colors.Green);
        return embed;
    }
}
