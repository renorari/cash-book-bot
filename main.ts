/*
    Money Count Bot
    Install: https://discord.com/oauth2/authorize?client_id=1480023145808396358&permissions=378880&integration_type=0&scope=bot+applications.commands
*/

import "dotenv/config";

import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Colors, EmbedBuilder, GatewayIntentBits,
    type InteractionEditReplyOptions, type InteractionReplyOptions, type MessageComponentInteraction,
    MessageFlags, type RepliableInteraction, SlashCommandBuilder, StringSelectMenuBuilder
} from "discord.js";

import { prisma } from "./utils/db.ts";
import log from "./utils/log.ts";

const TOKEN = process.env.DISCORD_BOT_TOKEN;

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!")
        .setDescriptionLocalization("ja", "Pong!と返信します。"),
    new SlashCommandBuilder()
        .setName("cashbook")
        .setDescription("Displays the cash book.")
        .setDescriptionLocalization("ja", "金銭出納帳を表示します。"),
    new SlashCommandBuilder()
        .setName("add")
        .setDescription("Adds a cash book entry.")
        .setDescriptionLocalization("ja", "金銭出納帳に記帳する")
        .addStringOption(option =>
            option.setName("date")
                .setDescription("Date of the entry (YYYY-MM-DD)")
                .setDescriptionLocalization("ja", "記帳の日付（YYYY-MM-DD）")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("description")
                .setDescription("Description of the entry")
                .setDescriptionLocalization("ja", "記帳の内容")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("amount")
                .setDescription("Amount of money (positive for income, negative for expense)")
                .setDescriptionLocalization("ja", "金額（収入は正、支出は負）")
                .setRequired(true))
];

if (!TOKEN) {
    log.getLogger().error("DISCORD_BOT_TOKEN is not set in environment variables.");
    process.exit(1);
}

const logger = log.getLogger();
const client = new Client({
    "intents": [
        GatewayIntentBits.Guilds
    ]
});

// ハンドラ内の rejection が error イベントとして送出されてもプロセスを落とさない
client.on("error", (error) => {
    logger.error(error);
});

/*
    インタラクショントークンは初回応答までの猶予が3秒しかなく、
    超えると Unknown interaction (10062) になる。
    DBアクセスなど時間のかかる処理の前に必ず defer し、応答は safeRespond 経由で行う。
*/
async function safeDefer(interaction: RepliableInteraction, ephemeral: boolean): Promise<boolean> {
    try {
        await interaction.deferReply(ephemeral ? { "flags": MessageFlags.Ephemeral } : {});
        return true;
    } catch (error) {
        logger.error(error);
        return false;
    }
}

async function safeDeferUpdate(interaction: MessageComponentInteraction): Promise<boolean> {
    try {
        await interaction.deferUpdate();
        return true;
    } catch (error) {
        logger.error(error);
        return false;
    }
}

// defer 済み・未応答のどちらでも応答でき、トークン失効時もログのみで握り潰す
async function safeRespond(interaction: RepliableInteraction, options: InteractionReplyOptions): Promise<void> {
    try {
        if (interaction.deferred || interaction.replied) {
            const editOptions = { ...options };
            // defer 時点で可視性が確定するため editReply では flags を送らない
            delete editOptions.flags;
            await interaction.editReply(editOptions as InteractionEditReplyOptions);
        } else {
            await interaction.reply(options);
        }
    } catch (error) {
        logger.error(error);
    }
}

client.on("clientReady", async () => {
    logger.info(`Logged in as ${client.user?.tag}!`);

    await client.application?.commands.set(commands);
    logger.info("Slash commands registered.");
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case "ping":
            await safeRespond(interaction, {
                "content": "Pong!",
                "embeds": [
                    new EmbedBuilder()
                        .setColor(Colors.Blurple)
                        .setTitle("ステータス")
                        .setFields([
                            {
                                "name": "WebSocketレイテンシー",
                                "value": `${client.ws.ping}ミリ秒`,
                                "inline": true
                            },
                            {
                                "name": "APIレイテンシー",
                                "value": `${Date.now() - interaction.createdTimestamp}ミリ秒`,
                                "inline": true
                            }
                        ])
                ]
            });
            break;
        case "cashbook":
            if (!(await safeDefer(interaction, false))) return;
            try {
                const entries = await prisma.cashBook.findMany({
                    "where": { "isRemoved": false },
                    "orderBy": { "date": "asc" }
                });

                if (entries.length === 0) {
                    await safeRespond(interaction, {
                        "content": "📒 金銭出納帳は空です。",
                        "flags": MessageFlags.Ephemeral
                    });
                } else {
                    const embed = new EmbedBuilder()
                        .setTitle("金銭出納帳")
                        .setDescription(entries.map(entry => `- ${entry.date.toISOString().split("T")[0]}: ${entry.description} (${entry.amount.toLocaleString("ja-JP", {"style": "currency", "currency": "JPY"})})`).join("\n"))
                        .setColor(Colors.Blurple)
                        .setFields([
                            {
                                "name":`月間合計(${new Date().getMonth() + 1}月)`,
                                "value": entries.filter(entry => {
                                    const now = new Date();
                                    return entry.date.getFullYear() === now.getFullYear() && entry.date.getMonth() === now.getMonth();
                                }).reduce((sum, entry) => sum + entry.amount, 0).toLocaleString("ja-JP", {"style": "currency", "currency": "JPY"}),
                                "inline": true
                            },
                            {
                                "name": "合計",
                                "value": entries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString("ja-JP", {"style": "currency", "currency": "JPY"}),
                                "inline": true
                            }
                        ])
                        .setTimestamp();

                    await safeRespond(interaction, {
                        "embeds": [embed],
                        "components": [
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("remove_entry")
                                        .setLabel("行を削除")
                                        .setStyle(ButtonStyle.Danger)
                                )
                        ]
                    });
                }
            } catch (error) {
                logger.error(error);
                await safeRespond(interaction, {
                    "content": "❌ 金銭出納帳の表示中にエラーが発生しました。",
                    "flags": MessageFlags.Ephemeral
                });
            }
            break;
        case "add": {
            const dateStr = interaction.options.getString("date", true);
            const description = interaction.options.getString("description", true);
            const amount = interaction.options.getInteger("amount", true);

            if (!(await safeDefer(interaction, true))) return;
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    await safeRespond(interaction, {
                        "content": "❌ 不正な日付形式です。\n> 例: 2026-10-11",
                        "flags": MessageFlags.Ephemeral
                    });
                    return;
                }

                await prisma.cashBook.create({
                    "data": {
                        date,
                        description,
                        amount
                    }
                });

                await prisma.auditLog.create({
                    "data": {
                        "action": "ADD_ENTRY",
                        "details": `Date: ${dateStr}, Description: ${description}, Amount: ${amount}`,
                        "userId": interaction.user.id
                    }
                });

                await safeRespond(interaction, {
                    "content": "✅ 記帳が完了しました。",
                    "flags": MessageFlags.Ephemeral
                });
            } catch (error) {
                logger.error(error);
                await safeRespond(interaction, {
                    "content": "❌ 記帳中にエラーが発生しました。",
                    "flags": MessageFlags.Ephemeral
                });
            }
            break;
        }
        default:
            await safeRespond(interaction, {
                "content": "❌ 不明なコマンドです。\nアプリケーションの再起動をお試しください。",
                "flags": MessageFlags.Ephemeral
            });
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "remove_entry") {
        if (!(await safeDefer(interaction, true))) return;

        try {
            const entries = await prisma.cashBook.findMany({
                "where": { "isRemoved": false },
                "orderBy": { "date": "desc" }
            });

            if (entries.length === 0) {
                await safeRespond(interaction, {
                    "content": "📒 削除できる行がありません。",
                    "flags": MessageFlags.Ephemeral
                });
                return;
            }

            await safeRespond(interaction, {
                "content": "行を削除するには、選択してください",
                "components": [
                    new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId("select_entry_to_remove")
                                .setPlaceholder("削除する行を選択")
                                .setOptions(
                                    // セレクトメニューの選択肢は最大25件
                                    entries.slice(0, 25).map(entry => ({
                                        "label": `${entry.date.toISOString().split("T")[0]}: ${entry.description}`,
                                        "value": entry.id
                                    }))
                                )
                        )
                ],
                "flags": MessageFlags.Ephemeral
            });
        } catch (error) {
            logger.error(error);
            await safeRespond(interaction, {
                "content": "❌ 削除する行の取得中にエラーが発生しました。",
                "flags": MessageFlags.Ephemeral
            });
        }
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === "select_entry_to_remove") {
        const entryId = interaction.values[0];

        if (!(await safeDeferUpdate(interaction))) return;
        try {
            await prisma.cashBook.update({
                "where": { "id": entryId },
                "data": { "isRemoved": true }
            });

            await prisma.auditLog.create({
                "data": {
                    "action": "REMOVE_ENTRY",
                    "details": `Entry ID: ${entryId}`,
                    "userId": interaction.user.id
                }
            });

            await safeRespond(interaction, {
                "content": "✅ 行が削除されました。",
                "components": []
            });
        } catch (error) {
            logger.error(error);
            await safeRespond(interaction, {
                "content": "❌ 行の削除中にエラーが発生しました。",
                "components": []
            });
        }
    }
});

client.login(TOKEN);
