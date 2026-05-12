export interface DBUserRankData {
    discordData: {
        id: string;
    };
    riotData: RiotUserData;
    timestamp: string;
}

export interface RiotUserData {
    name: string;
    tag: string;
    nowRank: string;
    nowRR: string;
    maxRank: string;
}

export interface DiscordUserData {
    id: string;
    name: string;
    icon: string;
}

export interface ValoTeamUserData {
    discordData: { id: string };
    riotData: RiotUserData | null;
    timestamp: string | null;
}

export interface ValoTeamSplitData {
    teamA: { id: string }[];
    teamB: { id: string }[];
    diff: number;
}

export interface UserRankRow {
    userid: string;
    riotName: string;
    riotTag: string;
    nowRank: string;
    nowRR: string;
    maxRank: string;
    timeStamp: string;
}
