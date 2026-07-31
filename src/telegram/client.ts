import { Bot } from "grammy";
import { config } from "../config";
import { logger } from "../logger";

export function startTelegram(registerHandlers: (bot: Bot) => void): Bot {
  const bot = new Bot(config.telegram.botToken);

  registerHandlers(bot);

  bot.catch((err) => {
    logger.error({ err: err.error }, "Error manejando una actualizacion de Telegram");
  });

  bot.start({
    onStart: () => logger.info("Bot de Telegram conectado (long polling)."),
  });

  return bot;
}
