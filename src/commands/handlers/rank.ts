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
import { dayjs, generateTimeStamp } from './common/utils.js';
import { apiGetUserRankData } from '../../api/henrik-api.js';
import { valoRankIcon } from '../../utils/icon.js';
import { ApiRequestError, MissingApiKeyError, UserNotFoundError } from '../../api/errors.js';
import { deleteUserRankFromDB, getUserRankFromDB, insertUserRankToDB } from '../../database/db.js';
import type { DBUserRankData, DiscordUserData, RiotUserData } from '../../utils/interface.js';
import {
    DB_UPDATE_INTERVAL,
    DB_UPDATE_TIME_UNIT,
    DEFAULT_TIME_ZONE,
    MODAL_TIMEOUT_MS,
    VALO_RIOT_ID_MODAL_ID,
    VALO_RIOT_ID_NAME_INPUT_ID,
    VALO_RIOT_ID_TAG_INPUT_ID,
} from '../../utils/config.js';

const riotIdModalId = VALO_RIOT_ID_MODAL_ID;
const nameInputModalId = VALO_RIOT_ID_NAME_INPUT_ID;
const tagInputModalId = VALO_RIOT_ID_TAG_INPUT_ID;

export async function handleValoRankCommand(i: ChatInputCommandInteraction) {
    const discordData: DiscordUserData = getDiscordUserData(i);
    const dbUserData: DBUserRankData | null = await getUserRankFromDB(discordData.id);
    const option = i.options.getBoolean('delete_option', false);
    //delete_optionじゃなくてもいいかも？
    if (option === true && dbUserData) {
        //削除が有効かつ登録されている場合
        await deleteUserRankFromDB(discordData.id);
        await i.reply({ embeds: [Embed.successDelete(dbUserData, discordData)] });
        return;
    } else if (dbUserData) {
        //登録されているとき
        await i.deferReply();
        const lastUpdated = dayjs(dbUserData.timestamp, 'YYYY-MM-DD HH:mm:ss').tz(
            DEFAULT_TIME_ZONE,
        );
        const hoursDiff = dayjs().diff(lastUpdated, DB_UPDATE_TIME_UNIT);
        try {
            await ifUserDataUpdate(hoursDiff, dbUserData);
        } catch (error) {
            if (error instanceof UserNotFoundError) {
                const [name, tag] = [dbUserData.riotData.name, dbUserData.riotData.tag];
                i.editReply({ embeds: [UserNotFoundError.embed(name, tag)] });
            } else if (error instanceof ApiRequestError || error instanceof MissingApiKeyError) {
                i.editReply({ embeds: [ApiRequestError.embed()] });
            }
            return;
        }
        await i.editReply({ embeds: [Embed.userDataInfo(dbUserData, discordData)] });
    } else {
        //登録されていないとき
        await i.showModal(Modal.inputRiotId(discordData));
        const filter = (modal: ModalSubmitInteraction) =>
            modal.customId === riotIdModalId + discordData.id;
        const modalInteraction = await i
            .awaitModalSubmit({ filter, time: MODAL_TIMEOUT_MS })
            .catch(() => null);
        if (!modalInteraction) return;
        await modalInteraction.deferReply();
        const { name, tag } = getModalInputValue(modalInteraction, discordData.id);
        try {
            const riotData: RiotUserData = await apiGetUserRankData(name, tag);
            const newUserData: DBUserRankData = formatUserDataForDb(discordData.id, riotData);
            await insertUserRankToDB(newUserData);
            await modalInteraction.editReply({
                embeds: [Embed.userDataInfo(newUserData, discordData)],
            });
        } catch (error) {
            if (error instanceof UserNotFoundError) {
                await modalInteraction.editReply({ embeds: [UserNotFoundError.embed(name, tag)] });
            } else if (error instanceof ApiRequestError) {
                await modalInteraction.editReply({ embeds: [ApiRequestError.embed()] });
            } else {
                console.log(error);
            }
            return;
        }
    }
    return;
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
    //タイムスタンプが1時間以内なら何も更新しない
    if (hoursDiff < DB_UPDATE_INTERVAL) return userData;
    //タイムスタンプが一時間を超えている場合は更新する
    try {
        userData.riotData = await apiGetUserRankData(userData.riotData.name, userData.riotData.tag);
        userData.timestamp = generateTimeStamp();
        await insertUserRankToDB(userData);
        return userData;
    } catch (error) {
        throw error;
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

class Embed {
    static userDataInfo(dbData: DBUserRankData, discordData: DiscordUserData) {
        const riotData: RiotUserData = dbData.riotData;
        const riotId = riotData.name + '#' + riotData.tag;
        const nowValue = valoRankIcon[riotData.nowRank] + riotData.nowRank;
        const maxValue = valoRankIcon[riotData.maxRank] + riotData.maxRank;
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
        const riotId = riotData.name + '#' + riotData.tag;
        const nowValue = valoRankIcon[riotData.nowRank] + riotData.nowRank;
        const maxValue = valoRankIcon[riotData.maxRank] + riotData.maxRank;
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
