import 'dotenv/config';
import mysql from 'mysql2/promise';
import type { DBUserRankData, UserRankRow } from '../utils/interface.js';
import { Log } from '../utils/log.js';

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
        Log.info('Starting user rank table initialization');
        await conn.query(createUserRank);
        Log.success('Completed user rank table initialization');
    } catch (error) {
        Log.error('Failed to initialize user rank table', error);
        throw error;
    } finally {
        conn.release();
    }
}
//riotName = VALUES(riotName),
//riotTag = VALUES(riotTag),
//ランクとかチーム分けとかそれ関連
export async function insertUserRankToDB(data: DBUserRankData) {
    const conn = await pool.getConnection();
    try {
        Log.info('Starting user rank data save', { userId: data.discordData.id });
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
        Log.success('Completed user rank data save', { userId: data.discordData.id });
    } catch (error) {
        Log.error('Failed to save user rank data', {
            userId: data.discordData.id,
            error: error,
        });
        throw error;
    } finally {
        conn.release();
    }
}

export async function deleteUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    try {
        Log.info('Starting user rank data deletion', { userId: userid });
        await conn.query('DELETE FROM userrank WHERE userid = ?', [userid]);
        Log.success('Completed user rank data deletion', { userId: userid });
    } catch (error) {
        Log.error('Failed to delete user rank data', { userId: userid, error: error });
        throw error;
    } finally {
        conn.release();
    }
}

export async function getUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    try {
        Log.info('Starting user rank data fetch', { userId: userid });
        const [rows] = await conn.query('SELECT * FROM userrank WHERE userid = ?', [userid]);
        const row = (rows as UserRankRow[])[0];
        Log.success('Completed user rank data fetch', {
            userId: userid,
            found: Boolean(row),
        });
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
    } catch (error) {
        Log.error('Failed to fetch user rank data', { userId: userid, error: error });
        throw error;
    } finally {
        conn.release();
    }
}

//summonコマンド関連
export async function getMemberRankFromDB(userIds: string[]) {
    const conn = await pool.getConnection();
    try {
        Log.info('Starting member rank data fetch', { requestedCount: userIds.length });
        const [rows] = await conn.query('SELECT * FROM userrank WHERE userid IN (?)', [userIds]);
        const result: Record<string, DBUserRankData> = {};
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
        Log.success('Completed member rank data fetch', {
            requestedCount: userIds.length,
            foundCount: Object.keys(result).length,
        });
        return result;
    } catch (error) {
        Log.error('Failed to fetch member rank data', {
            requestedCount: userIds.length,
            error: error,
        });
        throw error;
    } finally {
        conn.release();
    }
}
