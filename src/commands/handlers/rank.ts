import {
    Colors,
    EmbedBuilder,
    LabelBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
    type ChatInputCommandInteraction,
    type GuildMember,
} from 'discord.js';
import { diffFromNow, generateTimeStamp } from './common/utils.js';
import { apiGetUserRankData } from '../../api/henrik-api.js';
import { valoRankIcon } from '../../utils/icon.js';
import { henrikApiErrorEmbed, UserNotFoundError } from '../../api/errors.js';
import { deleteUserRankFromDB, getUserRankFromDB, insertUserRankToDB } from '../../database/db.js';
import type { DBUserRankData, DiscordUserData, RiotUserData } from '../../utils/interface.js';
import {
    DB_UPDATE_INTERVAL,
    DB_UPDATE_TIME_UNIT,
    MODAL_TIMEOUT_MS,
    VALO_RIOT_ID_MODAL_ID,
    VALO_RIOT_ID_NAME_INPUT_ID,
    VALO_RIOT_ID_TAG_INPUT_ID,
} from '../../utils/config.js';
import { Log } from '../../utils/log.js';

const riotIdModalId = VALO_RIOT_ID_MODAL_ID;
const nameInputModalId = VALO_RIOT_ID_NAME_INPUT_ID;
const tagInputModalId = VALO_RIOT_ID_TAG_INPUT_ID;

export async function handleValoRankCommand(i: ChatInputCommandInteraction) {
    const discordData: DiscordUserData = getDiscordUserData(i);
    const dbUserData: DBUserRankData | null = await getRegisteredRankData(discordData.id);
    const option = i.options.getBoolean('delete_option', false);

    if (option === true && dbUserData) {
        await deleteLinkedRank(i, dbUserData, discordData);
        return;
    }
    if (dbUserData) {
        await showRegisteredRank(i, dbUserData, discordData);
        return;
    }
    await showRankRegistrationModal(i, discordData);
}

async function getRegisteredRankData(userId: string) {
    Log.info('Checking rank registration status', { userId: userId });
    const dbUserData: DBUserRankData | null = await getUserRankFromDB(userId);
    Log.info('Checked rank registration status', {
        userId: userId,
        registered: Boolean(dbUserData),
    });
    return dbUserData;
}

async function deleteLinkedRank(
    i: ChatInputCommandInteraction,
    dbUserData: DBUserRankData,
    discordData: DiscordUserData,
) {
    Log.info('Starting user rank unlink', { userId: discordData.id });
    await deleteUserRankFromDB(discordData.id);
    Log.success('Completed user rank unlink', { userId: discordData.id });
    await i.reply({ embeds: [Embed.successDelete(dbUserData, discordData)] });
    Log.success('Sent rank unlink response');
}

async function showRegisteredRank(
    i: ChatInputCommandInteraction,
    dbUserData: DBUserRankData,
    discordData: DiscordUserData,
) {
    Log.info('Starting registered rank display', { userId: discordData.id });
    await i.deferReply();
    try {
        const hoursDiff = diffFromNow(dbUserData.timestamp, DB_UPDATE_TIME_UNIT);
        await ifUserDataUpdate(hoursDiff, dbUserData);
    } catch (error) {
        await replyRankUpdateError(i, dbUserData, error);
        return;
    }
    await i.editReply({ embeds: [Embed.userDataInfo(dbUserData, discordData)] });
    Log.success('Sent registered rank response', { userId: discordData.id });
}

async function replyRankUpdateError(
    i: ChatInputCommandInteraction,
    dbUserData: DBUserRankData,
    error: unknown,
) {
    const [name, tag] = [dbUserData.riotData.name, dbUserData.riotData.tag];
    Log.error('Failed to update registered rank data', error);
    if (error instanceof UserNotFoundError) {
        await notifyRegisteredRiotIdNotFound(i, dbUserData);
    }
    const errorEmbed = henrikApiErrorEmbed(error, name, tag);
    await i.editReply({ embeds: [errorEmbed] });
}

async function showRankRegistrationModal(
    i: ChatInputCommandInteraction,
    discordData: DiscordUserData,
) {
    Log.info('Showing rank registration modal', { userId: discordData.id });
    await i.showModal(Modal.inputRiotId(discordData));
    const modalInteraction = await awaitRankRegistrationModal(i, discordData.id);
    if (!modalInteraction) return;
    await registerRankFromModal(modalInteraction, discordData);
}

async function awaitRankRegistrationModal(i: ChatInputCommandInteraction, userId: string) {
    Log.info('Waiting for rank registration modal submission', { userId: userId });
    const filter = (modal: ModalSubmitInteraction) => modal.customId === riotIdModalId + userId;
    const modalInteraction = await i
        .awaitModalSubmit({ filter, time: MODAL_TIMEOUT_MS })
        .catch(() => null);
    if (!modalInteraction) {
        Log.warn('Rank registration modal timed out');
    }
    return modalInteraction;
}

async function registerRankFromModal(i: ModalSubmitInteraction, discordData: DiscordUserData) {
    Log.info('Starting rank registration modal handling');
    await i.deferReply();
    const { name, tag } = getModalInputValue(i, discordData.id);
    try {
        const riotData: RiotUserData = await apiGetUserRankData(name, tag);
        const newUserData: DBUserRankData = formatUserDataForDb(discordData.id, riotData);
        await insertUserRankToDB(newUserData);
        await i.editReply({
            embeds: [Embed.userDataInfo(newUserData, discordData)],
        });
        Log.success('Completed new rank registration and response', {
            userId: discordData.id,
        });
    } catch (error) {
        Log.error('Failed to register new rank data', error);
        const errorEmbed = henrikApiErrorEmbed(error, name, tag);
        await i.editReply({ embeds: [errorEmbed] });
    }
}

function getDiscordUserData(i: ChatInputCommandInteraction): DiscordUserData {
    return {
        id: i.user.id,
        name: (i.member as GuildMember)?.displayName ?? i.user.username,
        icon: i.user.displayAvatarURL(),
    };
}

async function ifUserDataUpdate(
    hoursDiff: number,
    userData: DBUserRankData,
): Promise<DBUserRankData> {
    if (hoursDiff < DB_UPDATE_INTERVAL) {
        Log.info('Using cached rank data because update interval has not elapsed', {
            userId: userData.discordData.id,
            elapsed: hoursDiff,
        });
        return userData;
    }

    Log.info('Starting stale rank data update', {
        userId: userData.discordData.id,
        elapsed: hoursDiff,
    });
    userData.riotData = await apiGetUserRankData(userData.riotData.name, userData.riotData.tag);
    userData.timestamp = generateTimeStamp();
    await insertUserRankToDB(userData);
    Log.success('Completed stale rank data update', {
        userId: userData.discordData.id,
    });
    return userData;
}

async function notifyRegisteredRiotIdNotFound(
    i: ChatInputCommandInteraction,
    userData: DBUserRankData,
) {
    try {
        Log.info('Sending registered Riot ID not found DM', {
            userId: userData.discordData.id,
            target: userData.riotData.name + '#' + userData.riotData.tag,
        });
        await i.user.send({ embeds: [Embed.registeredRiotIdNotFound(userData)] });
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

function getModalInputValue(i: ModalSubmitInteraction, userId: string) {
    return {
        name: i.fields.getTextInputValue(nameInputModalId + userId),
        tag: i.fields.getTextInputValue(tagInputModalId + userId),
    };
}

function formatUserDataForDb(id: string, riotData: RiotUserData): DBUserRankData {
    return {
        discordData: {
            id: id,
        },
        riotData: riotData,
        timestamp: generateTimeStamp(),
    };
}

function formatRiotId(riotData: RiotUserData) {
    return riotData.name + '#' + riotData.tag;
}

function formatRankValue(rank: string) {
    return valoRankIcon[rank] + rank;
}

class Embed {
    static userDataInfo(dbData: DBUserRankData, discordData: DiscordUserData) {
        const riotData: RiotUserData = dbData.riotData;
        const riotId = formatRiotId(riotData);
        const nowValue = formatRankValue(riotData.nowRank);
        const maxValue = formatRankValue(riotData.maxRank);
        return new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(discordData.name + 'さんのランク情報')
            .setFields(
                { name: 'Riot ID', value: riotId, inline: false },
                { name: '現在ランク', value: nowValue, inline: true },
                { name: 'RR情報', value: riotData.nowRR + 'RR', inline: true },
                { name: '最高ランク', value: maxValue, inline: false },
            )
            .setThumbnail(discordData.icon)
            .setFooter({ text: 'Last updated : ' + dbData.timestamp });
    }

    static successDelete(dbData: DBUserRankData, discordData: DiscordUserData) {
        const riotData: RiotUserData = dbData.riotData;
        const riotId = formatRiotId(riotData);
        const nowValue = formatRankValue(riotData.nowRank);
        const maxValue = formatRankValue(riotData.maxRank);
        return new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(discordData.name + 'さんのアカウント連携を解除しました')
            .setDescription('連携解除されたアカウント情報は以下の通りです')
            .setFields(
                { name: 'Riot ID', value: riotId, inline: false },
                { name: '現在ランク', value: nowValue, inline: true },
                { name: 'RR情報', value: riotData.nowRR + 'RR', inline: true },
                { name: '最高ランク', value: maxValue, inline: false },
            )
            .setThumbnail(discordData.icon);
    }

    static registeredRiotIdNotFound(dbData: DBUserRankData) {
        const riotId = formatRiotId(dbData.riotData);
        return new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('登録済みRiot IDが見つかりません')
            .setDescription(
                '登録されているRiot IDが存在しないため、ランク情報を更新できませんでした。アカウント削除やRiot ID変更の可能性があります。',
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
}

class Modal {
    static inputRiotId(discordData: DiscordUserData) {
        const modal = new ModalBuilder()
            .setCustomId(riotIdModalId + discordData.id)
            .setTitle('VALORANTランク登録');
        const name = new TextInputBuilder()
            .setCustomId(nameInputModalId + discordData.id)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('ゲーム名を入力（例: Taro）')
            .setMinLength(3)
            .setMaxLength(16);
        const tag = new TextInputBuilder()
            .setCustomId(tagInputModalId + discordData.id)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('タグラインを入力（例: 1234）')
            .setMinLength(2)
            .setMaxLength(5);

        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel('ゲーム名を入力してください(Taro#1234の場合Taro)')
                .setTextInputComponent(name),
            new LabelBuilder()
                .setLabel('タグラインを入力してください(Taro#1234の場合1234)')
                .setTextInputComponent(tag),
        );
        return modal;
    }
}
