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
