import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType,
    ChatInputCommandInteraction,
    Colors,
    ComponentType,
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
import type { DBUserRankData, ValoTeamSplitData, ValoTeamUserData } from '../../utils/interface.js';
import { Log } from '../../utils/log.js';
import {
    DB_UPDATE_INTERVAL,
    DB_UPDATE_TIME_UNIT,
    VALO_RANK_VALUE,
    VALO_VC_MAX_VALUE,
    VALO_VC_MIN_VALUE,
} from '../../utils/config.js';

type TeamMember = { id: string };
type SplitCandidate = ValoTeamSplitData;
type TeamSide = 'Attacker' | 'Defender';

export async function handleValoTeamCommand(i: ChatInputCommandInteraction) {
    if (!(await prepareTeamSplitCommand(i))) return;

    const sortType = i.options.getString('sort_option', true);
    const excludeOption = i.options.getBoolean('exclude_option') ?? false;
    const userIDs = getVcMemberUserID(i);
    const targetUserIDs = await selectTeamTargetUserIDs(i, userIDs, excludeOption);
    if (targetUserIDs.length < 1) return;

    Log.info('Fetching voice channel member rank data', { sortType });

    const valoTeamData: ValoTeamUserData[] = await initValoTeamData(i, targetUserIDs);
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
    Log.success('Completed team split candidate generation', {
        candidateCount: splitTeamData.length,
    });
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

async function initValoTeamData(i: ChatInputCommandInteraction, userIDs: string[]) {
    Log.info('Checked voice channel members', { userCount: userIDs.length });
    const dbData: Record<string, DBUserRankData> = await getMemberRankFromDB(userIDs);
    const unRegisterUser = userIDs.filter((id) => !dbData[id]);
    if (unRegisterUser.length > 0) {
        await replyUnregisteredUsers(i, unRegisterUser);
        return [];
    }
    return userIDs.map((id) => {
        const userData = dbData[id]!;
        return {
            discordData: { id },
            riotData: userData.riotData,
            timestamp: userData.timestamp,
        };
    });
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
        embeds: Embed.splitTeamResult(valoTeamData, splitTeamData, page, sortType, i.user.id),
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
        await Log.withContext(logContext, async () => {
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
        });
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
        embeds: Embed.splitTeamResult(valoTeamData, splitTeamData, page, sortType, userId),
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
        embeds: [statusEmbed.setTitle('VCの移動が正常に完了しました').setColor(Colors.Green)],
    });
    Log.success('Completed voice channel creation and team move', {
        sessionId: uniqueId,
    });
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

async function selectTeamTargetUserIDs(
    i: ChatInputCommandInteraction,
    userIDs: string[],
    excludeOption: boolean,
) {
    const canExclude = userIDs.length > VALO_VC_MIN_VALUE;
    const shouldSelectExcludeUsers = (userIDs.length >= 11 || excludeOption) && canExclude;
    if (!shouldSelectExcludeUsers) return userIDs;

    Log.info('Starting team exclude member selection', {
        userCount: userIDs.length,
        excludeOption,
    });
    await i.editReply({
        embeds: [Embed.excludeMemberSelect(userIDs)],
        components: [Button.excludeMemberSelect(i, userIDs)],
    });

    try {
        const reply = await i.fetchReply();
        const interaction = await reply.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            filter: (m) => m.user.id === i.user.id && m.customId === 'team_exclude_select',
            time: 600_000,
        });
        const excludeUserIDs = interaction.values;
        const targetUserIDs = userIDs.filter((id) => !excludeUserIDs.includes(id));

        Log.success('Completed team exclude member selection', {
            excludedUserCount: excludeUserIDs.length,
            targetUserCount: targetUserIDs.length,
        });
        await interaction.update({
            embeds: [Embed.excludeMemberSelected(excludeUserIDs, targetUserIDs)],
            components: [],
        });
        return targetUserIDs;
    } catch (error) {
        Log.warn('Team exclude member selection timed out or failed', { error });
        await i.editReply({
            embeds: [Embed.excludeMemberSelectionTimeout()],
            components: [],
        });
        return [];
    }
}

async function updateOldUserData(
    i: ChatInputCommandInteraction,
    valoTeamData: ValoTeamUserData[],
): Promise<ValoTeamUserData[]> {
    const targets = valoTeamData.filter(shouldUpdateRankData);
    Log.info('Checked rank update targets', { targetCount: targets.length });

    const concurrency = 2;
    let index = 0;
    const notFoundUsers: ValoTeamUserData[] = [];

    const worker = async () => {
        while (true) {
            const currentIndex = index++;
            if (currentIndex >= targets.length) return;

            const user = targets[currentIndex]!;
            if (!(await updateTeamUserRank(i, user))) notFoundUsers.push(user);
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()),
    );
    return notFoundUsers;
}

function shouldUpdateRankData(user: ValoTeamUserData) {
    return (
        user.riotData &&
        user.timestamp &&
        diffFromNow(user.timestamp, DB_UPDATE_TIME_UNIT) >= DB_UPDATE_INTERVAL
    );
}

async function updateTeamUserRank(i: ChatInputCommandInteraction, user: ValoTeamUserData) {
    if (!user.riotData) return true;

    try {
        const riotData = await apiGetUserRankData(user.riotData.name, user.riotData.tag);
        const timestamp = generateTimeStamp();

        await insertUserRankToDB({
            discordData: { id: user.discordData.id },
            riotData,
            timestamp,
        });

        user.riotData = riotData;
        user.timestamp = timestamp;
        Log.success('Completed user rank update', { userId: user.discordData.id });
        return true;
    } catch (error) {
        Log.error('Failed to update user rank data', { userId: user.discordData.id, error });
        if (!(error instanceof UserNotFoundError)) return true;

        await notifyRegisteredRiotIdNotFound(i, user);
        return false;
    }
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
            error,
        });
    }
}

function splitBalancedTeams(valoTeamData: ValoTeamUserData[], sortType: string) {
    const users = toRankedUsers(valoTeamData, sortType);
    const len = users.length;
    const teamASize = Math.ceil(len / 2);
    const teamBSize = len - teamASize;

    const results: SplitCandidate[] = [];
    const seen = new Set<string>();
    const teamA: TeamMember[] = [];
    const teamB: TeamMember[] = [];

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

function createTeamCombinationKey(teamA: TeamMember[], teamB: TeamMember[]) {
    const keyA = teamA
        .map((u) => u.id)
        .sort()
        .join(',');
    const keyB = teamB
        .map((u) => u.id)
        .sort()
        .join(',');
    return keyA < keyB ? `${keyA}_${keyB}` : `${keyB}_${keyA}`;
}

function formatSplitResults(results: SplitCandidate[]) {
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
    const [attackerChannel, defenderChannel] = await Promise.all([
        i.guild?.channels.create({
            name: generatedVoiceChannelName('Attacker', id),
            type: 2,
            parent: category,
        }),
        i.guild?.channels.create({
            name: generatedVoiceChannelName('Defender', id),
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
    const guild = i.guild;
    const attackerVC = findGeneratedVoiceChannel(i, 'Attacker', id);
    const defenderVC = findGeneratedVoiceChannel(i, 'Defender', id);
    if (!attackerVC || !defenderVC) {
        Log.error('User move aborted because generated voice channels were not found', {
            sessionId: id,
        });
        await i.followUp({ content: 'VCが見つかりませんでした', ephemeral: true });
        return;
    }

    const movePromises = [
        ...moveTeamMembers(guild, splitData.teamA, attackerVC),
        ...moveTeamMembers(guild, splitData.teamB, defenderVC),
    ];

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

function generatedVoiceChannelName(side: TeamSide, id: string) {
    return `${side}(自動生成)${id}`;
}

function findGeneratedVoiceChannel(i: ButtonInteraction, side: TeamSide, id: string) {
    return i.guild?.channels.cache.find(
        (ch) =>
            ch.type === ChannelType.GuildVoice && ch.name === generatedVoiceChannelName(side, id),
    ) as VoiceChannel | undefined;
}

function moveTeamMembers(
    guild: ButtonInteraction['guild'],
    members: TeamMember[],
    channel: VoiceChannel,
) {
    return members.flatMap(({ id }) => {
        const member = guild?.members.cache.get(id);
        return member?.voice.channelId ? [member.voice.setChannel(channel)] : [];
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
            .addFields({
                name: 'コピー用',
                value: '```\n/valo rank\n```',
                inline: false,
            })
            .setColor(Colors.Red);
    }

    static registeredRiotIdNotFound(dbData: ValoTeamUserData) {
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('登録済みRiot IDが見つかりません')
            .setDescription(
                'チーム分け時のランク更新で、登録されているRiot IDが存在しないためランク情報を更新できませんでした。アカウント削除やRiot ID変更の可能性があります。',
            )
            .setFields(
                { name: '登録中のRiot ID', value: formatRiotId(dbData), inline: false },
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

    static excludeMemberSelect(ids: string[]) {
        return new EmbedBuilder()
            .setTitle('除外するユーザーを選択してください')
            .setDescription(
                'チーム分けから除外するユーザーを選択してください。選択後、残ったユーザーでチーム分けを実行します。',
            )
            .setFields(userMentionFields(ids))
            .setColor(Colors.Yellow);
    }

    static excludeMemberSelected(excludeUserIDs: string[], targetUserIDs: string[]) {
        return new EmbedBuilder()
            .setTitle('除外ユーザーを反映しました')
            .setDescription('除外後のユーザーでチーム分けを続行します')
            .setFields(
                {
                    name: '除外ユーザー',
                    value: mentionUsers(excludeUserIDs),
                    inline: false,
                },
                {
                    name: 'チーム分け対象人数',
                    value: String(targetUserIDs.length) + '人',
                    inline: false,
                },
            )
            .setColor(Colors.Green);
    }

    static excludeMemberSelectionTimeout() {
        return new EmbedBuilder()
            .setTitle('除外選択がタイムアウトしました')
            .setDescription('除外選択が完了しなかったため、チーム分け処理を終了しました')
            .setColor(Colors.Red);
    }

    static splitTeamResult(
        teamData: ValoTeamUserData[],
        splitData: ValoTeamSplitData[],
        page: number,
        sortType: string,
        id: string,
    ) {
        const rankKey = sortType === 'max' ? 'maxRank' : 'nowRank';
        const getRankIcon = createRankIconResolver(teamData, rankKey);
        const currentSplit = splitData[page];
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
        const footer = new EmbedBuilder().setDescription(
            `組み合わせ表示とVC移動はコマンド実行ユーザーのみ実行可能です\nコマンド実行ユーザー：<@${id}>`,
        );
        return [
            header,
            teamEmbed('Attacker', currentSplit?.teamA, getRankIcon, Colors.Red),
            teamEmbed('Defender', currentSplit?.teamB, getRankIcon, Colors.Blue),
            footer,
        ];
    }

    static generateVoiceChannel(id: string) {
        return new EmbedBuilder()
            .setTitle('VCの移動を実行中')
            .setColor(Colors.Yellow)
            .setDescription('VCを自動生成しました\nSession-IDは`/valo vc-summon`コマンドで使います')
            .addFields(
                {
                    name: 'Session-ID',
                    value: `\`\`\`text\n${id}\n\`\`\``,
                },
                {
                    name: 'コピー用コマンド',
                    value: `\`\`\`text\n/valo vc-summon session_id:${id}\n\`\`\``,
                },
            )
            .setFooter({ text: '※自動生成したVCは全ユーザーが退出後自動的に削除されます' });
    }
}

function formatRiotId(userData: ValoTeamUserData) {
    return userData.riotData ? userData.riotData.name + '#' + userData.riotData.tag : 'Unknown';
}

function userMentionFields(ids: string[]) {
    return ids.map((id) => ({
        name: '',
        value: `・<@${id}>`,
        inline: false,
    }));
}

function createRankIconResolver(teamData: ValoTeamUserData[], rankKey: 'nowRank' | 'maxRank') {
    const unratedIcon = valoRankIcon.Unrated ?? '';
    const rankIcons = new Map(
        teamData.map((user) => {
            const rankName = user.riotData?.[rankKey] ?? 'Unrated';
            return [user.discordData.id, valoRankIcon[rankName] ?? unratedIcon];
        }),
    );
    return (userId: string) => rankIcons.get(userId) ?? unratedIcon;
}

function teamEmbed(
    title: TeamSide,
    members: TeamMember[] | undefined,
    getRankIcon: (userId: string) => string,
    color: number,
) {
    return new EmbedBuilder()
        .setTitle(title)
        .setFields(
            members?.map((member) => ({
                name: '',
                value: `${getRankIcon(member.id)} <@${member.id}>`,
                inline: false,
            })) ?? [],
        )
        .setColor(color);
}

class Button {
    static excludeMemberSelect(i: ChatInputCommandInteraction, userIDs: string[]) {
        const options = userIDs.map((id) => {
            const member = i.guild?.members.cache.get(id);
            const label = (member?.displayName ?? id).slice(0, 100);
            return {
                label,
                value: id,
                description: 'User ID: ' + id,
            };
        });
        const menu = new StringSelectMenuBuilder()
            .setCustomId('team_exclude_select')
            .setPlaceholder('除外するユーザーを選択')
            .setMinValues(1)
            .setMaxValues(userIDs.length - VALO_VC_MIN_VALUE)
            .addOptions(options);
        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    }

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
