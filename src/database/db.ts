import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Log } from '../utils/logger.js';
import type { DBuserRankData } from '../utils/interface.js';

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
            userid INT NOT NULL,
            maxCategory VARCHAR(32),
            maxTire INT NOT NULL,
            nowCategory VARCHAR(32),
            nowTire INT NOT NULL,
            timeStamp DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
    `;
    const conn = await pool.getConnection();
    await conn.query(createUserRank);
    conn.release();
    Log.success('Database tables initialized successfully.');
}

export async function insertUserRankToDB(userdata: DBuserRankData) {
    const conn = await pool.getConnection();
    await conn.query(
        `INSERT INTO userrank (userid, maxCategory, maxTire, nowCategory, nowTire)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            maxCategory = VALUES(maxCategory),
            maxTire = VALUES(maxTire),
            nowCategory = VALUES(nowCategory),
            nowTire = VALUES(nowTire),
            timeStamp = CURRENT_TIMESTAMP
        `,
        [
            userdata.userid,
            userdata.maxCategory,
            userdata.maxTire,
            userdata.nowCategory,
            userdata.nowTire,
        ]
    );
    conn.release();
}

export async function getUserRankFromDB(userid: string) {
    const conn = await pool.getConnection();
    const [rows] = (await conn.query('SELECT * FROM userrank WHERE userid = ?', [userid])) as [
        DBuserRankData[],
        any
    ];
    conn.release();
    return rows?.[0] ?? null;
}
