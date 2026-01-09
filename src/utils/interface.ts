export interface RankInfo {
    category: string[];
    tier: string[];
    noTireCategory: string[];
    rankIcon: { [key: string]: string };
}

export interface slashDiceData {
    name: string;
    icon: string;
    value: number;
}

export interface slashValoMapData {
    option: string;
    map?: string;
    mapImage?: string;
    miniMapImage?: string;
}

//ここが新しく作成してる範囲
export interface DiscordUserData {
    userName: string;
    userId: string;
    userIcon: string;
}

export interface DBUserRankData {
    maxCategory: string | null;
    maxTier: string | null;
    nowCategory: string | null;
    nowTier: string | null;
    timeStamp: string | null;
}

export interface ValoMapData {
    mapName: string;
    mapImage: string;
    miniMapImage: string;
    competitive: boolean;
}
