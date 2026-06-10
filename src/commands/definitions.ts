import { ChannelType, SlashCommandBuilder } from 'discord.js';

export const commandDefinitions = [
    new SlashCommandBuilder()
        .setName('valo')
        .setDescription('VALORANT関連コマンド')
        .addSubcommand((sub) =>
            sub
                .setName('rank')
                .setDescription('VALORANTのランク情報を連携・表示します')
                .addBooleanOption((option) =>
                    option
                        .setName('delete_option')
                        .setDescription('連携されているランクを解除します')
                        .setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('team')
                .setDescription('ランクデータに基づきチーム分けを実行します')
                .addStringOption((option) =>
                    option
                        .setName('sort_option')
                        .setDescription('チーム分けの基準となるランクを設定します')
                        .setRequired(true)
                        .setChoices({ name: 'now', value: 'now' }, { name: 'max', value: 'max' }),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('exclude_option')
                        .setDescription('チーム分け前に除外するユーザーを選択します')
                        .setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('vc-summon')
                .setDescription('1箇所のVCにユーザーを集めます')
                .addStringOption((option) =>
                    option
                        .setName('session_id')
                        .setDescription('/valo teamコマンドで生成したSession-IDを入力してください')
                        .setRequired(true),
                )
                .addChannelOption((option) =>
                    option
                        .setName('target_vc')
                        .setDescription('移動先のVCを選択してください')
                        .addChannelTypes(ChannelType.GuildVoice)
                        .setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub.setName('map').setDescription('VALORANTのマップをランダムに出力します'),
        ),
].map((command) => command.toJSON());
