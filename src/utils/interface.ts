export interface MapInfo {
    name: string;
    competitive: boolean;
    mapImage: string;
    miniMapImage: string;
    selected?: boolean;
}

export interface RankInfo {
    category: string[];
    tire: number[];
    noTireCategory: string[];
    rankIcon: { [key: string]: string };
}

export interface DBuserRankData {
    userid: string;
    maxCategory: string;
    maxTire: string;
    nowCategory: string;
    nowTire: string;
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
