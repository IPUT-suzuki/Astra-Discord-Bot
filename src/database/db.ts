import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Log } from '../utils/logger.js';
import type { DBUserRankData, DBuserRankData, DiscordUserData } from '../utils/interface.js';

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
            maxCategory VARCHAR(32),
            maxTier VARCHAR(32),
            nowCategory VARCHAR(32),
            nowTier VARCHAR(32),
            timeStamp VARCHAR(32)
        );
    `;
    const conn = await pool.getConnection();
    await conn.query(createUserRank);
    conn.release();
    Log.success('Database tables initialized successfully.');
}

export async function insertUserRankToDB(user: DiscordUserData, rank: DBUserRankData) {
    const conn = await pool.getConnection();
    await conn.query(
        `INSERT INTO userrank (userid, maxCategory, maxTier, nowCategory, nowTier, timeStamp)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            maxCategory = VALUES(maxCategory),
            maxTier = VALUES(maxTier),
            nowCategory = VALUES(nowCategory),
            nowTier = VALUES(nowTier),
            timeStamp = VALUES(timeStamp)
        `,
        [user.userId, rank.maxCategory, rank.maxTier, rank.nowCategory, rank.nowTier, rank.timeStamp]
    );
    conn.release();
}

export async function deleteUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM userrank WHERE userid = ?', [userid]);
    conn.release();
}

export async function getUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    const [rows] = (await conn.query('SELECT * FROM userrank WHERE userid = ?', [userid])) as [DBUserRankData[], any];
    conn.release();
    return rows?.[0] ?? null;
}
