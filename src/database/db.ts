import 'dotenv/config';
import mysql from 'mysql2/promise';
import type { DBUserRankData, UserRankRow } from '../utils/interface.js';

const pool = mysql.createPool({
    host: 'localhost',
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_USE_DATABASE as string,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export async function initTablesInDB() {
    const createUserRank = `
        CREATE TABLE IF NOT EXISTS userrank (
            userid VARCHAR(32) NOT NULL PRIMARY KEY,
            riotName VARCHAR(32),
            riotTag VARCHAR(32),
            nowRank VARCHAR(32),
            nowRR VARCHAR(32),
            maxRank VARCHAR(32),
            timeStamp VARCHAR(32)
        );
    `;
    const conn = await pool.getConnection();
    try {
        await conn.query(createUserRank);
    } finally {
        conn.release();
    }
}

//ランクとかチーム分けとかそれ関連
export async function insertUserRankToDB(data: DBUserRankData) {
    const conn = await pool.getConnection();
    try {
        await conn.query(
            `INSERT INTO userrank (userid, riotName, riotTag, nowRank, nowRR, maxRank, timeStamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                riotName = VALUES(riotName),
                riotTag = VALUES(riotTag),
                nowRank = VALUES(nowRank),
                nowRR = VALUES(nowRR),
                maxRank = VALUES(maxRank),
                timeStamp = VALUES(timeStamp)
            `,
            [
                data.discordData.id,
                data.riotData.name,
                data.riotData.tag,
                data.riotData.nowRank,
                data.riotData.nowRR,
                data.riotData.maxRank,
                data.timestamp,
            ],
        );
    } finally {
        conn.release();
    }
}

export async function deleteUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM userrank WHERE userid = ?', [userid]);
    conn.release();
}

export async function getUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM userrank WHERE userid = ?', [userid]);
    const row = (rows as UserRankRow[])[0];
    conn.release();
    if (!row) return null;
    return {
        discordData: { id: row.userid },
        riotData: {
            name: row.riotName,
            tag: row.riotTag,
            nowRank: row.nowRank,
            nowRR: row.nowRR,
            maxRank: row.maxRank,
        },
        timestamp: row.timeStamp ?? '',
    };
}

//summonコマンド関連
export async function getMemberRankFromDB(userIds: string[]) {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM userrank WHERE userid IN (?)', [userIds]);
    conn.release();
    const result: Record<string, any> = {};
    for (const row of rows as UserRankRow[]) {
        result[row.userid] = {
            discordData: { id: row.userid },
            riotData: {
                name: row.riotName,
                tag: row.riotTag,
                nowRank: row.nowRank,
                nowRR: row.nowRR,
                maxRank: row.maxRank,
            },
            timestamp: row.timeStamp ?? '',
        };
    }
    return result;
}
