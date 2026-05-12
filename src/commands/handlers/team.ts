import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildChannel,
    MessageFlags,
    StringSelectMenuBuilder,
    User,
    VoiceChannel,
    type GuildMember,
} from 'discord.js';
import { Check } from './common/check.js';
import { getMemberRankFromDB, insertUserRankToDB } from '../../database/db.js';
import type { ValoTeamSplitData, ValoTeamUserData } from '../../utils/interface.js';
import { apiGetUserRankData } from '../../api/api.js';
import { valoRankIcon } from '../../utils/icon.js';
import {
    DB_UPDATE_INTERVAL,
    DB_UPDATE_TIME_UNIT,
    VALO_RANK_VALUE,
    VALO_VC_MAX_VALUE,
    VALO_VC_MIN_VALUE,
} from '../../utils/config.js';
import { diffFromNow, generateTimeStamp } from './common/uitls.js';
import { testUserData } from '../../testdata/testUserData.js';
import { randomUUID } from 'crypto';

export async function handleValoTeamCommand(i: ChatInputCommandInteraction) {
    //最初のチェック
    if (!(await Check.isCommandChannel(i))) return;
    if (!(await Check.isUserVcState(i))) return;
    if (!(await Check.underVcUser(i, VALO_VC_MIN_VALUE))) return;
    if (!(await Check.overVcUser(i, VALO_VC_MAX_VALUE))) return;
    const sortType = i.options.getString('sort_option', true);
    let valoTeamData: ValoTeamUserData[] = await initValoTeamData(i);
    if (valoTeamData.length < 1) return;
    await updateOldUserData(valoTeamData);
    let page = 0;
    // valoTeamData = testUserData;
    const splitTeamData: ValoTeamSplitData[] = splitBalancedTeams(valoTeamData, sortType);
    await i.reply({
        embeds: Embed.splitTeamResault(valoTeamData, splitTeamData, page, sortType, i.user.id),
        components: [Button.teamSelect(splitTeamData, page), Button.moveVoiceChannel()],
    });
    const reply = await i.fetchReply();
    const collector = reply.createMessageComponentCollector({
        filter: (m) => m.user.id === i.user.id,
        time: 600_000,
    });
    collector.on('collect', async (interaction) => {
        if (interaction.isStringSelectMenu()) {
            //セレクトメニュー処理
            page = Number(interaction.values[0]);
            await interaction.update({
                embeds: Embed.splitTeamResault(
                    valoTeamData,
                    splitTeamData,
                    page,
                    sortType,
                    i.user.id,
                ),
                components: [Button.teamSelect(splitTeamData, page), Button.moveVoiceChannel()],
            });
        } else if (interaction.isButton()) {
            // ボタン処理
            const uniqueId = randomUUID(); // 例: 'b8a1c2e0-7e6b-4c2a-9e2e-1a2b3c4d5e6f'
            await generateVoiceChannel(interaction, uniqueId);
            await interaction.update({ components: [] });
            const statusEmbed = Embed.generateVoiceChannel(uniqueId);
            const sendMessage = await interaction.followUp({ embeds: [statusEmbed] });
            await moveTeamsToVoiceChannels(interaction, splitTeamData[page]!, uniqueId);
            sendMessage.edit({
                embeds: [
                    statusEmbed.setTitle('VCの移動が正常に完了しました').setColor(Colors.Green),
                ],
            });
        }
    });
    collector.on('end', async () => {
        await reply.edit({ components: [] });
    });
}

async function initValoTeamData(i: ChatInputCommandInteraction) {
    const userIDs: string[] = getVcMemberUserID(i);
    const dbData: Record<string, any> = await getMemberRankFromDB(userIDs);
    const unRegisterUser = userIDs.filter((id) => !dbData[id]);
    if (unRegisterUser.length > 0) {
        const mentions = unRegisterUser.map((id) => `<@${id}>`).join(' ');
        await i.reply({
            content: mentions,
            allowedMentions: { users: unRegisterUser },
            embeds: [Embed.unregisterUsers(unRegisterUser)],
        });
        return [];
    }
    return userIDs.map((id) => ({
        discordData: { id },
        riotData: dbData[id].riotData,
        timestamp: dbData[id].timestamp,
    }));
}

function getVcMemberUserID(i: ChatInputCommandInteraction) {
    const channel = (i.member as GuildMember)?.voice?.channel;
    if (!channel) return []; //一応
    return [...channel.members.values()].map((m) => m.user.id);
}

async function updateOldUserData(valoTeamData: ValoTeamUserData[]): Promise<void> {
    // 1時間以上前のデータを持つユーザーのみ抽出
    const targets = valoTeamData.filter(
        (user) =>
            user.riotData &&
            user.timestamp &&
            diffFromNow(user.timestamp, DB_UPDATE_TIME_UNIT) >= DB_UPDATE_INTERVAL,
    );

    // 並列でAPIリクエスト＆DB更新
    await Promise.all(
        targets.map(async (user) => {
            try {
                const newRiotData = await apiGetUserRankData(
                    user.riotData!.name,
                    user.riotData!.tag,
                );
                const newTimestamp = generateTimeStamp();
                // DB更新
                await insertUserRankToDB({
                    discordData: { id: user.discordData.id },
                    riotData: newRiotData,
                    timestamp: newTimestamp,
                });
                // 必要ならメモリ上のuser.riotData, user.timestampも更新
                user.riotData = newRiotData;
                user.timestamp = newTimestamp;
            } catch (e) {
                // エラーハンドリング
                console.error(`Update failed for user ${user.discordData.id}:`, e);
            }
        }),
    );
}

function splitBalancedTeams(valoTeamData: ValoTeamUserData[], sortType: string) {
    const rankKey = sortType === 'max' ? 'maxRank' : 'nowRank';
    const users = [...valoTeamData].map((user) => {
        const rankName = user.riotData?.[rankKey] ?? 'Unrated';
        const rankValue = VALO_RANK_VALUE[rankName] ?? 0;
        return { user, rankValue };
    });

    users.sort((a, b) => b.rankValue - a.rankValue);

    const len = users.length;
    const teamASize = Math.ceil(len / 2);
    const teamBSize = len - teamASize;

    const results: Array<{ teamA: { id: string }[]; teamB: { id: string }[]; diff: number }> = [];
    const seen = new Set<string>();
    const teamA: { id: string }[] = [];
    const teamB: { id: string }[] = [];

    const tryAllCombinations = (index: number, teamAValue: number, teamBValue: number) => {
        if (index === len) {
            if (teamA.length !== teamASize || teamB.length !== teamBSize) return;
            const diff = Math.abs(teamAValue - teamBValue);

            const teamAIds = teamA.map((u) => u.id).sort();
            const teamBIds = teamB.map((u) => u.id).sort();
            const keyA = teamAIds.join(',');
            const keyB = teamBIds.join(',');
            const key = keyA < keyB ? `${keyA}_${keyB}` : `${keyB}_${keyA}`;

            if (!seen.has(key)) {
                seen.add(key);
                results.push({
                    teamA: [...teamA],
                    teamB: [...teamB],
                    diff: Math.round(diff * 100) / 100,
                });
            }
            return;
        }

        const current = users[index]!;
        if (teamA.length < teamASize) {
            teamA.push({ id: current.user.discordData.id });
            tryAllCombinations(index + 1, teamAValue + current.rankValue, teamBValue);
            teamA.pop();
        }
        if (teamB.length < teamBSize) {
            teamB.push({ id: current.user.discordData.id });
            tryAllCombinations(index + 1, teamAValue, teamBValue + current.rankValue);
            teamB.pop();
        }
    };

    tryAllCombinations(0, 0, 0);
    results.sort((a, b) => a.diff - b.diff);
    const prioritized = [
        ...results.filter((r) => r.diff <= 3),
        ...results.filter((r) => r.diff > 3),
    ];

    return prioritized.slice(0, 25).map((r) => ({
        teamA: r.teamA,
        teamB: r.teamB,
        diff: r.diff,
    }));
}

async function generateVoiceChannel(i: ButtonInteraction, id: string) {
    const category = (i.channel as GuildChannel).parent;
    // 例: 現在の日時やランダム値、またはDBやキャッシュで管理する連番
    const [attackerChannel, defenderChannel] = await Promise.all([
        i.guild?.channels.create({
            name: `Attacker(自動生成)${id}`,
            type: 2,
            parent: category,
        }),
        i.guild?.channels.create({
            name: `Defender(自動生成)${id}`,
            type: 2,
            parent: category,
        }),
    ]);
    console.log('Attacker VC ID:', attackerChannel?.id);
    console.log('Defender VC ID:', defenderChannel?.id);
}

async function moveTeamsToVoiceChannels(
    i: ButtonInteraction,
    splitData: ValoTeamSplitData,
    id: string,
) {
    //VCを取得（idから生成したVC名で検索）
    const guild = i.guild;
    const attackerVC = guild?.channels.cache.find(
        (ch) => ch.type === 2 && ch.name === `Attacker(自動生成)${id}`,
    ) as VoiceChannel | undefined;
    const defenderVC = guild?.channels.cache.find(
        (ch) => ch.type === 2 && ch.name === `Defender(自動生成)${id}`,
    ) as VoiceChannel | undefined;
    if (!attackerVC || !defenderVC) {
        await i.followUp({ content: 'VCが見つかりませんでした', ephemeral: true });
        return;
    }
    //ユーザーを取得して移動
    const movePromises: Promise<any>[] = [];
    for (const memberId of splitData.teamA.map((u) => u.id)) {
        const member = guild?.members.cache.get(memberId);
        if (member && member.voice.channelId) {
            movePromises.push(member.voice.setChannel(attackerVC));
        }
    }
    for (const memberId of splitData.teamB.map((u) => u.id)) {
        const member = guild?.members.cache.get(memberId);
        if (member && member.voice.channelId) {
            movePromises.push(member.voice.setChannel(defenderVC));
        }
    }

    await Promise.all(movePromises);
}

class Embed {
    static unregisterUsers(ids: string[]) {
        const fields = ids.map((id) => ({
            name: '',
            value: `・<@${id}>`,
            inline: false,
        }));
        return new EmbedBuilder()
            .setTitle('未登録ユーザーがいます')
            .setDescription(
                '未登録ユーザーがいるためチーム分け処理を終了しました\n以下のユーザーは`/valo rank`コマンドを実施してください',
            )
            .setFields(fields)
            .setColor(Colors.Red);
    }

    static splitTeamResault(
        teamData: ValoTeamUserData[],
        splitData: ValoTeamSplitData[],
        page: number,
        sortType: string,
        id: string,
    ) {
        const rankKey = sortType === 'max' ? 'maxRank' : 'nowRank';
        const getRankIcon = (userId: string) => {
            const user = teamData.find((u) => u.discordData.id === userId);
            const rankName = user?.riotData?.[rankKey] ?? 'Unrated';
            return valoRankIcon[rankName] ?? valoRankIcon.Unrated;
        };
        const teamAFields = splitData[page]?.teamA.map((member) => ({
            name: '',
            value: `${getRankIcon(member.id)} <@${member.id}>`,
            inline: false,
        }));
        const teamBFields = splitData[page]?.teamB.map((member) => ({
            name: '',
            value: `${getRankIcon(member.id)} <@${member.id}>`,
            inline: false,
        }));
        const header = new EmbedBuilder()
            .setTitle('チーム分けが完了しました')
            .setFields(
                { name: '組み合わせ総数', value: '', inline: true },
                { name: '➤', value: '', inline: true },
                { name: `${splitData.length}組`, value: '', inline: true },
                { name: '表示中の組み合わせ', value: '', inline: true },
                { name: '➤', value: '', inline: true },
                { name: `${page + 1}`, value: '', inline: true },
                { name: '戦力差', value: '', inline: true },
                { name: '➤', value: '', inline: true },
                { name: `${splitData[page]?.diff}`, value: '', inline: true },
            )
            .setColor(Colors.Green);
        const teamA = new EmbedBuilder()
            .setTitle('Attacker')
            .setFields(teamAFields ?? [])
            .setColor(Colors.Red);
        const teamB = new EmbedBuilder()
            .setTitle('Defender')
            .setFields(teamBFields ?? [])
            .setColor(Colors.Blue);
        const footer = new EmbedBuilder().setDescription(
            `組み合わせ表示とVC移動はコマンド実行ユーザーのみ実行可能です\nコマンド実行ユーザー：<@${id}>`,
        );
        return [header, teamA, teamB, footer];
    }

    static generateVoiceChannel(id: string) {
        return new EmbedBuilder()
            .setTitle('VCの移動を実行中')
            .setColor(Colors.Yellow)
            .setDescription('VCを自動生成しました\nSession-IDは`/valo vc-summon`コマンドで使います')
            .addFields({
                name: 'Session-ID',
                value: `\`\`\`text\n${id}\n\`\`\``,
            })
            .setFooter({ text: '※自動生成したVCは全ユーザーが退出後自動的に削除されます' });
    }
}

class Button {
    static teamSelect(splitData: ValoTeamSplitData[], page: number) {
        const options = splitData.map((d, idx) => ({
            label: idx === page ? `組み合わせ ${idx + 1} (現在表示中)` : `組み合わせ ${idx + 1}`,
            value: String(idx),
            description: `戦力差 ${d.diff}`,
        }));
        const menu = new StringSelectMenuBuilder()
            .setCustomId('team_select')
            .setPlaceholder('他の組み合わせを表示')
            .addOptions(options);
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    }

    static moveVoiceChannel() {
        const button = new ButtonBuilder()
            .setCustomId('valo-vc-move')
            .setStyle(ButtonStyle.Success)
            .setLabel('VCを移動する');
        return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    }
}
