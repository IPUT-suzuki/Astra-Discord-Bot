export interface MapInfo {
    name: string;
    competitive: boolean;
    mapImage: string;
    miniMapImage: string;
    selected?: boolean;
}

export interface RankInfo {
    category: string[];
    tier: string[];
    noTireCategory: string[];
    rankIcon: { [key: string]: string };
}

export interface DBuserRankData {
    userid: string;
    username: string;
    usericon: string;
    maxCategory: string | null;
    maxTier: string | null;
    nowCategory: string | null;
    nowTier: string | null;
    timeStamp?: string | null;
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
