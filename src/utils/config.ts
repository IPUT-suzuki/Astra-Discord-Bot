export const DEBUG_MODE = true;
// タイムゾーン設定
export const DEFAULT_TIME_ZONE = 'Asia/Tokyo';

// データ更新関連の設定
export const DB_UPDATE_TIME_UNIT = 'seconds'; // DB更新の差分単位
export const DB_UPDATE_INTERVAL = 1; // DB更新の基準時間 単位はDB_UPDATE_TIME_UNITに従う

// API設定
export const REQUEST_REGION = 'ap'; // APIでどの地域のデータを取得するか
export const REQUEST_PLATFORMS = 'pc';
export const API_TIMEOUT_MS = 1000 * 8; // APIリクエストのタイムアウト時間

// VALO TEAM コマンド関連設定
export const VALO_TEAM_COMMAND_OPTION = 'option';
export const VALO_VC_MIN_VALUE = 2; // default 2
export const VALO_VC_MAX_VALUE = 25; // default 25
export const VALO_RANK_VALUE: Record<string, number> = {
    // 各ランクの数値
    Unrated: 4.0,
    'Unknown 1': 4.0,
    'Unknown 2': 4.0,

    'Iron 1': 2.0,
    'Iron 2': 2.65,
    'Iron 3': 3.33,

    'Bronze 1': 4.0,
    'Bronze 2': 4.65,
    'Bronze 3': 5.33,

    'Silver 1': 6.0,
    'Silver 2': 6.83,
    'Silver 3': 7.67,

    'Gold 1': 8.5,
    'Gold 2': 9.25,
    'Gold 3': 9.75,

    'Platinum 1': 10.0,
    'Platinum 2': 11.0,
    'Platinum 3': 12.0,

    'Diamond 1': 12.5,
    'Diamond 2': 13.5,
    'Diamond 3': 14.25,

    'Ascendant 1': 15.0,
    'Ascendant 2': 18.5,
    'Ascendant 3': 20.5,

    'Immortal 1': 22.5,
    'Immortal 2': 25.5,
    'Immortal 3': 28.0,

    Radiant: 30.0,
};
//VALO RANKコマンド関連設定
export const VALO_RIOT_ID_MODAL_ID = 'valo-rank-modal';
export const VALO_RIOT_ID_NAME_INPUT_ID = 'riot-id-name';
export const VALO_RIOT_ID_TAG_INPUT_ID = 'riot-id-tag';
//MODAL関連共通
export const MODAL_TIMEOUT_MS = 1000 * 60 * 10; //10分間
