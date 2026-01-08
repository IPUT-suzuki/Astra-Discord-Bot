import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Colors, EmbedBuilder } from 'discord.js';
import { Log } from '../utils/logger.js';
import type { slashDiceData } from '../utils/interface.js';

export class Dice {
    i: ChatInputCommandInteraction;
    data: slashDiceData;
    constructor(interaction: ChatInputCommandInteraction) {
        this.i = interaction;
        this.data = {
            name: this.i.member ? (this.i.member as GuildMember).displayName : this.i.user.username,
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
    static result(data: slashDiceData) {
        return new EmbedBuilder()
            .setAuthor({ name: data.name, iconURL: data.icon })
            .setTitle(`ダイス結果 : ${data.value}`)
            .setColor(Colors.Green);
    }
}
