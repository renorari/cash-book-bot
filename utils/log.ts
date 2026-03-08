/*
    log4js configuration
*/

import log4js from "log4js";

const isProduction = process.env.NODE_ENV === "production";

log4js.configure({
    "appenders": {
        "console": { "type": "console" },
        "consoleInfo": {
            "type": "logLevelFilter",
            "appender": "console",
            "level": "info"
        },
        "file": {
            "type": "dateFile",
            "filename": "logs/discord.log",
            "pattern": "yyyy-MM-dd",
            "keepFileExt": true,
            // 5年 ≒ 1826日保持
            "numBackups": 1826,
            "compress": true,
            // 現在の出力は app.log を維持し、ローテーション時に日付付きへリネーム
            "alwaysIncludePattern": false
        },
        "fileInfo": {
            "type": "logLevelFilter",
            "appender": "file",
            "level": "info"
        }
    },
    "categories": {
        "default": {
            "appenders": isProduction ? ["consoleInfo", "fileInfo"] : ["console"],
            "level": "debug"
        }
    }
});

const log = log4js;

export default log;
