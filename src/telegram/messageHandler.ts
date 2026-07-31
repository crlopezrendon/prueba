import { Bot } from "grammy";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { config, loadContacts, loadNotionSpaces } from "../config";
import { logger } from "../logger";
import { convertOggToMp3 } from "../audio/convert";
import { transcribeAudio } from "../transcription/whisper";
import { parseIntent } from "../nlu/intentParser";
import { describeIntent, executeIntent } from "../actions";
import { getPending, setPending, clearPending } from "../state/pendingActions";

const CONFIRM_WORDS = ["si", "sí", "confirmar", "confirmo", "dale", "ok", "envialo", "enviala"];
const CANCEL_WORDS = ["no", "cancelar", "cancela", "detente"];

async function downloadTelegramFile(filePath: string): Promise<string> {
  const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
  const response = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
  const localPath = path.join(os.tmpdir(), `${randomUUID()}.ogg`);
  fs.writeFileSync(localPath, Buffer.from(response.data));
  return localPath;
}

export function registerHandlers(bot: Bot): void {
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id.toString() !== config.telegram.chatId) return;
    await next();
  });

  bot.on("message:text", async (ctx) => {
    const normalized = ctx.message.text.trim().toLowerCase();
    const pending = getPending(config.telegram.chatId);

    if (pending && CONFIRM_WORDS.includes(normalized)) {
      clearPending(config.telegram.chatId);
      await ctx.reply("⏳ Procesando...");
      try {
        const result = await executeIntent(pending.intent);
        await ctx.reply(result);
      } catch (err) {
        logger.error({ err }, "Error ejecutando la accion confirmada");
        await ctx.reply(`❌ Ocurrio un error ejecutando la accion: ${(err as Error).message}`);
      }
      return;
    }

    if (pending && CANCEL_WORDS.includes(normalized)) {
      clearPending(config.telegram.chatId);
      await ctx.reply("🚫 Accion cancelada.");
    }
  });

  bot.on(["message:voice", "message:audio"], async (ctx) => {
    await ctx.reply("🎧 Escuchando tu audio...");

    let oggPath: string | undefined;
    let mp3Path: string | undefined;
    try {
      const file = await ctx.getFile();
      if (!file.file_path) throw new Error("Telegram no devolvio la ruta del archivo de audio.");
      oggPath = await downloadTelegramFile(file.file_path);
      mp3Path = await convertOggToMp3(oggPath);

      const transcript = await transcribeAudio(mp3Path);
      logger.info({ transcript }, "Audio transcrito");

      const contacts = loadContacts();
      const spaces = loadNotionSpaces();
      const intent = await parseIntent(transcript, contacts, spaces);

      if (intent.action === "unknown") {
        await ctx.reply(
          `🤔 Transcribi: "${transcript}"\n\nNo logre identificar si es un correo o una tarea. ` +
            `Intenta ser mas especifico (ej. "envia un correo a Juan..." o "crea una tarea en marketing...").`
        );
        return;
      }

      if (config.requireConfirmation) {
        setPending(config.telegram.chatId, { intent, transcript, createdAt: Date.now() });
        await ctx.reply(describeIntent(intent), { parse_mode: "Markdown" });
      } else {
        await ctx.reply(`🗣️ Transcribi: "${transcript}"\n⏳ Ejecutando...`);
        const result = await executeIntent(intent);
        await ctx.reply(result);
      }
    } catch (err) {
      logger.error({ err }, "Error procesando audio");
      await ctx.reply(`❌ Ocurrio un error procesando el audio: ${(err as Error).message}`);
    } finally {
      if (oggPath && fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
      if (mp3Path && fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
    }
  });
}
