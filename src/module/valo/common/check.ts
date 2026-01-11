import { ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember } from 'discord.js';

export class Check {
    private static guildCheck(interaction: ChatInputCommandInteraction) {
        //サーバー内の場合false,サーバー外の場合true
        return !interaction.inGuild();
    }
    private static vcCheck(interaction: ChatInputCommandInteraction) {
        //vc接続している場合false,接続していない場合true
        return !(interaction.member as GuildMember).voice.channel;
    }
    private static vcUserCountCheck(interaction: ChatInputCommandInteraction, value: number) {
        //vcに規定の人数がいるかチェック
        const voiceChannel = (interaction.member as GuildMember).voice.channel;
        return voiceChannel!.members.size < value;
    }

    static valoTeamCheck(interaction: ChatInputCommandInteraction) {
        const isExclude = interaction.options.getBoolean('exclude-option', false) ?? false;
        if (this.guildCheck(interaction)) {
            return Embed.noGuild();
        }
        if (this.vcCheck(interaction)) {
            return Embed.noConnectVc();
        }
        if (this.vcUserCountCheck(interaction, isExclude ? 3 : 2)) {
            return Embed.notEnoughPeopleInVc(isExclude ? 3 : 2);
        }
        if (!this.vcUserCountCheck(interaction, 25)) {
            return Embed.overVcUser();
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
        return this.errorEmbed().setDescription(
            `同じVC内に${value}名以上のユーザーが必要です\n他のユーザーをVCに招待してください`
        );
    }
    static overVcUser() {
        return this.errorEmbed().setDescription('同じVC内に25名を超えるユーザーがいます\nVC内の人数を25名以下にしてください');
    }
}
