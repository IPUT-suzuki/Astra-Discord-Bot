import { ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember } from 'discord.js';

export class Check {
    private static guildCheck(interaction: ChatInputCommandInteraction) {
        return !interaction.inGuild();
    }
    private static vcCheck(interaction: ChatInputCommandInteraction) {
        return !(interaction.member as GuildMember).voice.channel;
    }
    private static vcUserCountCheck(interaction: ChatInputCommandInteraction, value: number) {
        const voiceChannel = (interaction.member as GuildMember).voice.channel;
        return voiceChannel!.members.size < value;
    }

    static valoTeamCheck(interaction: ChatInputCommandInteraction) {
        if (this.guildCheck(interaction)) {
            return Embed.noGuild();
        }
        if (this.vcCheck(interaction)) {
            return Embed.noConnectVc();
        }
        if (this.vcUserCountCheck(interaction, 2)) {
            return Embed.notEnoughPeopleInVc(2);
        }
        return null; // 問題なければnull
    }
}

class Embed {
    private static errorEmbed() {
        return new EmbedBuilder().setColor(Colors.Red).setTitle('ERROR');
    }
    static noGuild() {
        return this.errorEmbed().setDescription('このコマンドはサーバー内でのみ有効です');
    }
    static noConnectVc() {
        return this.errorEmbed().setDescription('VCに接続されていません\nVCに接続してから実行してください');
    }
    static notEnoughPeopleInVc(value: number) {
        return this.errorEmbed().setDescription(`同じVCに${value}名以上のユーザーが必要です\n他のユーザーをVCに招待してください`);
    }
}
