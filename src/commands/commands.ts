import 'dotenv/config';
import { REST, Routes } from 'discord.js';

//valo send dmコマンドは悩み中
//valo bo1各種コマンドは/valo ban/pickコマンドに変更
export const commands = [
    {
        name: 'valo',
        description: 'VALORANT関連コマンド',
        options: [
            {
                name: 'rank',
                description: 'VALORANTのランク情報を登録・更新・削除します',
                type: 1,
            },
            {
                name: 'team',
                description: '登録ランクに応じたVALORANTのチーム分けを行います',
                type: 1,
                options: [
                    {
                        name: 'option',
                        description: 'チーム分けの基準とするランクを選択してください',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'random', value: 'random' },
                            { name: 'max', value: 'max' },
                            { name: 'now', value: 'now' },
                        ],
                    },
                    {
                        name: 'exclude-option',
                        description: '特定ユーザーを除外する場合は有効にしてください',
                        type: 5,
                        required: false,
                    },
                ],
            },
            {
                name: 'map',
                description: 'VALORANTのマップ抽選を行います',
                type: 1,
                options: [
                    {
                        name: 'option',
                        description: '抽選に使用するマッププールを選択してください',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'all', value: 'all' },
                            { name: 'competitive', value: 'competitive' },
                            { name: 'exclude', value: 'exclude' },
                        ],
                    },
                ],
            },
            {
                name: 'list',
                description: 'VC内ユーザーの登録ランクを一覧表示します',
                type: 1,
                options: [
                    {
                        name: 'option',
                        description: '一覧表示する基準のランクを選択してください',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'max', value: 'max' },
                            { name: 'now', value: 'now' },
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: 'dice',
        description: '1～100の間でランダムな数字を返します',
        type: 1,
    },
    {
        name: 'help',
        description: 'Astraの使い方',
        type: 1,
    },
];

export async function commandsRegister() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID as string), // config. を削除
            { body: commands }
        );
        console.log('コマンド登録成功');
    } catch (error) {
        console.error('コマンド登録エラー:', error);
    }
}

export async function commandsDelete() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);

    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID as string), {
            body: [],
        });
        console.log('コマンド削除成功');
    } catch (error) {
        console.error('コマンド削除エラー:', error);
    }
}
await commandsDelete();
await commandsRegister();
