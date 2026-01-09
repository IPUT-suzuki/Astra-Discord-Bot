export interface ValoRankData {
    category: string[];
    tier: string[];
    noTireCategory: string[];
    rankIcon: { [key: string]: string };
}

export interface ValoMapData {
    mapName: string;
    mapImage: string;
    miniMapImage: string;
    competitive: boolean;
}

export interface slashDiceData {
    name: string;
    icon: string;
    value: number;
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
