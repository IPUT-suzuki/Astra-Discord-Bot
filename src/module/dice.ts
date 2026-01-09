import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Colors, EmbedBuilder } from 'discord.js';
import { Log } from '../utils/logger.js';
import type { DiscordUserData } from '../utils/interface.js';

export class Dice {
    interaction: ChatInputCommandInteraction;
    user: DiscordUserData;
    constructor(interaction: ChatInputCommandInteraction) {
        this.interaction = interaction;
        this.user = {
            userName: (interaction.member as GuildMember)?.displayName ?? interaction.user.username,
            userId: interaction.user.id,
            userIcon: interaction.user.displayAvatarURL(),
        };
    }
    async start() {
        const value = Math.floor(Math.random() * 100) + 1;
        await this.interaction.reply({
            embeds: [Embed.result(this.user, value)],
        });
    }
}

class Embed {
    static result(userData: DiscordUserData, value: number) {
        return new EmbedBuilder()
            .setAuthor({ name: userData.userName, iconURL: userData.userIcon })
            .setTitle(`ダイス結果 : ${value}`)
            .setColor(Colors.Green);
    }
}
