import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildChannel,
    StringSelectMenuInteraction,
    StringSelectMenuBuilder,
    VoiceChannel,
    type GuildMember,
} from 'discord.js';
import { randomUUID } from 'crypto';
import { Check } from './common/check.js';
import { diffFromNow, generateTimeStamp } from './common/utils.js';
import { getMemberRankFromDB, insertUserRankToDB } from '../../database/db.js';
import { apiGetUserRankData } from '../../api/henrik-api.js';
import { UserNotFoundError } from '../../api/errors.js';
import { valoRankIcon } from '../../utils/icon.js';
import type { ValoTeamSplitData, ValoTeamUserData } from '../../utils/interface.js';
import { Log } from '../../utils/log.js';
import {
    DB_UPDATE_INTERVAL,
    DB_UPDATE_TIME_UNIT,
    VALO_RANK_VALUE,
    VALO_VC_MAX_VALUE,
    VALO_VC_MIN_VALUE,
} from '../../utils/config.js';

export async function handleValoTeamCommand(i: ChatInputCommandInteraction) {
    if (!(await prepareTeamSplitCommand(i))) return;

    const sortType = i.options.getString('sort_option', true);
    Log.info('Fetching voice channel member rank data', { sortType: sortType });

    const valoTeamData: ValoTeamUserData[] = await initValoTeamData(i);
    if (valoTeamData.length < 1) return;

    Log.info('Starting stale member rank update', { userCount: valoTeamData.length });
    const notFoundUsers = await updateOldUserData(i, valoTeamData);
    Log.success('Completed stale member rank update check');
    if (notFoundUsers.length > 0) {
        await replyRegisteredRiotIdNotFoundUsers(i, notFoundUsers);
        return;
    }

    Log.info('Starting rank-based team split', {
        userCount: valoTeamData.length,
        sortType,
    });
    const splitTeamData: ValoTeamSplitData[] = splitBalancedTeams(valoTeamData, sortType);
    Log.success('Completed team split candidate generation', { candidateCount: splitTeamData.length });
    await sendSplitTeamResponse(i, valoTeamData, splitTeamData, sortType, 0);
    await collectTeamSplitComponents(i, valoTeamData, splitTeamData, sortType);
}

async function prepareTeamSplitCommand(i: ChatInputCommandInteraction) {
    Log.info('Starting team split precheck');
    if (!(await Check.isCommandChannel(i))) return false;
    if (!(await Check.isUserVcState(i))) return false;
    if (!(await Check.underVcUser(i, VALO_VC_MIN_VALUE))) return false;
    if (!(await Check.overVcUser(i, VALO_VC_MAX_VALUE))) return false;
    await i.deferReply();
    return true;
}

async function replyRegisteredRiotIdNotFoundUsers(
    i: ChatInputCommandInteraction,
    users: ValoTeamUserData[],
) {
    const userIds = users.map((user) => user.discordData.id);
    Log.warn('Team split aborted because some registered Riot IDs were not found', {
        userIds: userIds,
    });
    await i.editReply({
        content: mentionUsers(userIds),
        allowedMentions: { users: userIds },
        embeds: [Embed.registeredRiotIdNotFoundUsers(users)],
    });
}

async function sendSplitTeamResponse(
    i: ChatInputCommandInteraction,
    valoTeamData: ValoTeamUserData[],
    splitTeamData: ValoTeamSplitData[],
    sortType: string,
    page: number,
) {
    await i.editReply({
        embeds: Embed.splitTeamResault(valoTeamData, splitTeamData, page, sortType, i.user.id),
        components: [Button.teamSelect(splitTeamData, page), Button.moveVoiceChannel()],
    });
    Log.success('Sent team split response');
}

async function collectTeamSplitComponents(
    i: ChatInputCommandInteraction,
    valoTeamData: ValoTeamUserData[],
    splitTeamData: ValoTeamSplitData[],
    sortType: string,
) {
    let page = 0;
    const reply = await i.fetchReply();
    const logContext = Log.getContext();
    const collector = reply.createMessageComponentCollector({
        filter: (m) => m.user.id === i.user.id,
        time: 600_000,
    });
    collector.on('collect', async (interaction) => {
        await Log.withContext(
            logContext,
            async () => {
                try {
                    if (interaction.isStringSelectMenu()) {
                        page = await updateSelectedTeamSplit(
                            interaction,
                            valoTeamData,
                            splitTeamData,
                            sortType,
                            i.user.id,
                        );
                    } else if (interaction.isButton()) {
                        await moveSelectedTeams(interaction, splitTeamData[page]!);
                    }
                } catch (error) {
                    Log.error('Team split component handling failed', error);
                }
            },
        );
    });
    collector.on('end', async () => {
        try {
            await reply.edit({ components: [] });
            Log.info('Ended team split component collection');
        } catch (error) {
            Log.error('Failed to end team split component collection', error);
        }
    });
}

async function updateSelectedTeamSplit(
    i: StringSelectMenuInteraction,
    valoTeamData: ValoTeamUserData[],
    splitTeamData: ValoTeamSplitData[],
    sortType: string,
    userId: string,
) {
    const page = Number(i.values[0]);
    Log.info('Changing displayed team split candidate', { page: page + 1 });
    await i.update({
        embeds: Embed.splitTeamResault(valoTeamData, splitTeamData, page, sortType, userId),
        components: [Button.teamSelect(splitTeamData, page), Button.moveVoiceChannel()],
    });
    Log.success('Completed displayed team split candidate change', { page: page + 1 });
    return page;
}

async function moveSelectedTeams(i: ButtonInteraction, splitData: ValoTeamSplitData) {
    const uniqueId = randomUUID();
    Log.info('Starting team move voice channel creation', { sessionId: uniqueId });
    await generateVoiceChannel(i, uniqueId);
    await i.update({ components: [] });
    const statusEmbed = Embed.generateVoiceChannel(uniqueId);
    const sendMessage = await i.followUp({ embeds: [statusEmbed] });
    await moveTeamsToVoiceChannels(i, splitData, uniqueId);
    await sendMessage.edit({
        embeds: [
            statusEmbed
                .setTitle('VCの移動が正常に完了しました')
                .setColor(Colors.Green),
        ],
    });
    Log.success('Completed voice channel creation and team move', {
        sessionId: uniqueId,
    });
}

async function initValoTeamData(i: ChatInputCommandInteraction) {
    const userIDs: string[] = getVcMemberUserID(i);
    Log.info('Checked voice channel members', { userCount: userIDs.length });
    const dbData: Record<string, any> = await getMemberRankFromDB(userIDs);
    const unRegisterUser = userIDs.filter((id) => !dbData[id]);
    if (unRegisterUser.length > 0) {
        await replyUnregisteredUsers(i, unRegisterUser);
        return [];
    }
    return userIDs.map((id) => ({
        discordData: { id },
        riotData: dbData[id].riotData,
        timestamp: dbData[id].timestamp,
    }));
}

async function replyUnregisteredUsers(i: ChatInputCommandInteraction, userIds: string[]) {
    Log.warn('Team split aborted because some users are not registered', {
        unregisteredUserIds: userIds,
    });
    await i.editReply({
        content: mentionUsers(userIds),
        allowedMentions: { users: userIds },
        embeds: [Embed.unregisterUsers(userIds)],
    });
}

function mentionUsers(userIds: string[]) {
    return userIds.map((id) => `<@${id}>`).join(' ');
}

function getVcMemberUserID(i: ChatInputCommandInteraction) {
    const channel = (i.member as GuildMember)?.voice?.channel;
    if (!channel) return []; //一応
    return [...channel.members.values()].map((m) => m.user.id);
}

async function updateOldUserData(
    i: ChatInputCommandInteraction,
    valoTeamData: ValoTeamUserData[],
): Promise<ValoTeamUserData[]> {
    // 1時間以上前のデータを持つユーザーのみ抽出
    const targets = valoTeamData.filter(
        (user) =>
            user.riotData &&
            user.timestamp &&
            diffFromNow(user.timestamp, DB_UPDATE_TIME_UNIT) >= DB_UPDATE_INTERVAL,
    );

    Log.info('Checked rank update targets', { targetCount: targets.length });
    const concurrency = 2;
    let index = 0;
    const notFoundUsers: ValoTeamUserData[] = [];

    const worker = async () => {
        while (true) {
            const currentIndex = index++;
            if (currentIndex >= targets.length) return;

            const user = targets[currentIndex]!;
            try {
                const newRiotData = await apiGetUserRankData(
                    user.riotData!.name,
                    user.riotData!.tag,
                );
                const newTimestamp = generateTimeStamp();

                await insertUserRankToDB({
                    discordData: { id: user.discordData.id },
                    riotData: newRiotData,
                    timestamp: newTimestamp,
                });

                user.riotData = newRiotData;
                user.timestamp = newTimestamp;
                Log.success('Completed user rank update', {
                    userId: user.discordData.id,
                });
            } catch (error) {
                Log.error('Failed to update user rank data', {
                    userId: user.discordData.id,
                    error: error,
                });
                if (error instanceof UserNotFoundError) {
                    notFoundUsers.push(user);
                    await notifyRegisteredRiotIdNotFound(i, user);
                }
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()),
    );
    return notFoundUsers;
}


async function notifyRegisteredRiotIdNotFound(
    i: ChatInputCommandInteraction,
    userData: ValoTeamUserData,
) {
    if (!userData.riotData) return;

    try {
        Log.info('Sending registered Riot ID not found DM', {
            userId: userData.discordData.id,
            target: userData.riotData.name + '#' + userData.riotData.tag,
        });
        const user = await i.client.users.fetch(userData.discordData.id);
        await user.send({ embeds: [Embed.registeredRiotIdNotFound(userData)] });
        Log.success('Sent registered Riot ID not found DM', {
            userId: userData.discordData.id,
        });
    } catch (error) {
        Log.warn('Failed to send registered Riot ID not found DM', {
            userId: userData.discordData.id,
            error: error,
        });
    }
}

function splitBalancedTeams(valoTeamData: ValoTeamUserData[], sortType: string) {
    const users = toRankedUsers(valoTeamData, sortType);
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
            const key = createTeamCombinationKey(teamA, teamB);
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
    return formatSplitResults(results);
}

function toRankedUsers(valoTeamData: ValoTeamUserData[], sortType: string) {
    const rankKey = sortType === 'max' ? 'maxRank' : 'nowRank';
    return [...valoTeamData]
        .map((user) => {
            const rankName = user.riotData?.[rankKey] ?? 'Unrated';
            const rankValue = VALO_RANK_VALUE[rankName] ?? 0;
            return { user, rankValue };
        })
        .sort((a, b) => b.rankValue - a.rankValue);
}

function createTeamCombinationKey(teamA: { id: string }[], teamB: { id: string }[]) {
    const keyA = teamA.map((u) => u.id).sort().join(',');
    const keyB = teamB.map((u) => u.id).sort().join(',');
    return keyA < keyB ? `${keyA}_${keyB}` : `${keyB}_${keyA}`;
}

function formatSplitResults(
    results: Array<{ teamA: { id: string }[]; teamB: { id: string }[]; diff: number }>,
) {
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
    Log.success('Completed team move voice channel creation', {
        attackerChannelId: attackerChannel?.id,
        defenderChannelId: defenderChannel?.id,
    });
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
        Log.error('User move aborted because generated voice channels were not found', {
            sessionId: id,
        });
        await i.followUp({ content: 'VCが見つかりませんでした', ephemeral: true });
        return;
    }
    //ユーザーを取得して移動
    const movePromises: Promise<unknown>[] = [];
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

    Log.info('Starting team member voice channel move', {
        sessionId: id,
        targetUserCount: movePromises.length,
    });
    await Promise.all(movePromises);
    Log.success('Completed team member voice channel move', {
        sessionId: id,
        movedUserCount: movePromises.length,
    });
}

class Embed {
    static unregisterUsers(ids: string[]) {
        return new EmbedBuilder()
            .setTitle('未登録ユーザーがいます')
            .setDescription(
                '未登録ユーザーがいるためチーム分け処理を終了しました\n以下のユーザーは`/valo rank`コマンドを実施してください',
            )
            .setFields(userMentionFields(ids))
            .setColor(Colors.Red);
    }


    static registeredRiotIdNotFound(dbData: ValoTeamUserData) {
        const riotId = dbData.riotData
            ? dbData.riotData.name + '#' + dbData.riotData.tag
            : 'Unknown';
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('登録済みRiot IDが見つかりません')
            .setDescription(
                'チーム分け時のランク更新で、登録されているRiot IDが存在しないためランク情報を更新できませんでした。アカウント削除やRiot ID変更の可能性があります。',
            )
            .setFields(
                { name: '登録中のRiot ID', value: riotId, inline: false },
                {
                    name: '対応方法',
                    value: '/valo rank delete_option:true を実行し、連携を解除してから、現在のRiot IDで再登録してください。',
                    inline: false,
                },
                {
                    name: 'コピー用',
                    value: '```\n/valo rank delete_option:true\n```',
                    inline: false,
                },
            );
    }


    static registeredRiotIdNotFoundUsers(users: ValoTeamUserData[]) {
        return new EmbedBuilder()
            .setTitle('登録済みRiot IDが見つからないユーザーがいます')
            .setDescription(
                '登録済みRiot IDが存在しないユーザーがいるため、チーム分け処理を中断しました。該当ユーザーにはDMで対応方法を送信しています。',
            )
            .setFields(userMentionFields(users.map((user) => user.discordData.id)))
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

function userMentionFields(ids: string[]) {
    return ids.map((id) => ({
        name: '',
        value: `・<@${id}>`,
        inline: false,
    }));
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
