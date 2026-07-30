import { downloadMediaMessage, WAMessage, WASocket } from "@whiskeysockets/baileys";
import { config, loadContacts, loadNotionSpaces } from "../config";
import { logger } from "../logger";
import { convertOggToMp3 } from "../audio/convert";
import { transcribeAudio } from "../transcription/whisper";
import { parseIntent } from "../nlu/intentParser";
import { sendEmail } from "../integrations/zoho";
import { createTask } from "../integrations/notion";
import { getPending, setPending, clearPending } from "../state/pendingActions";
import { CreateTaskIntent, SendEmailIntent } from "../types";
import fs from "fs";

const CONFIRM_WORDS = ["si", "sí", "confirmar", "confirmo", "dale", "ok", "envialo", "enviala"];
const CANCEL_WORDS = ["no", "cancelar", "cancela", "detente"];

function getMessageText(message: WAMessage): string | undefined {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    undefined
  );
}

function resolveEmails(names: string[], contacts: ReturnType<typeof loadContacts>): {
  emails: string[];
  unresolved: string[];
} {
  const emails: string[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const contact = contacts[name.trim().toLowerCase()];
    if (contact) {
      emails.push(contact.email);
    } else {
      unresolved.push(name);
    }
  }
  return { emails, unresolved };
}

async function describeIntent(
  intent: SendEmailIntent | CreateTaskIntent,
  contacts: ReturnType<typeof loadContacts>
): Promise<string> {
  if (intent.action === "send_email") {
    return (
      `📧 *Borrador de correo*\n` +
      `Para: ${intent.to_names.join(", ")}\n` +
      (intent.cc_names?.length ? `CC: ${intent.cc_names.join(", ")}\n` : "") +
      `Asunto: ${intent.subject}\n\n${intent.body}\n\n` +
      `Responde *sí* para enviarlo o *no* para cancelar.`
    );
  }
  return (
    `📝 *Nueva tarea en Notion (${intent.space})*\n` +
    `Titulo: ${intent.title}\n` +
    (intent.assignee_name ? `Asignado a: ${intent.assignee_name}\n` : "") +
    (intent.due_date ? `Fecha limite: ${intent.due_date}\n` : "") +
    (intent.description ? `Detalle: ${intent.description}\n` : "") +
    `\nResponde *sí* para crearla o *no* para cancelar.`
  );
}

async function executeIntent(
  intent: SendEmailIntent | CreateTaskIntent
): Promise<string> {
  const contacts = loadContacts();

  if (intent.action === "send_email") {
    const { emails, unresolved } = resolveEmails(intent.to_names, contacts);
    if (unresolved.length > 0 || emails.length === 0) {
      return (
        `⚠️ No encontre en tus contactos a: ${unresolved.join(", ") || "el destinatario"}. ` +
        `Agregalos en config/contacts.json e intenta de nuevo.`
      );
    }
    const { emails: ccEmails } = resolveEmails(intent.cc_names || [], contacts);
    await sendEmail({
      toAddresses: emails,
      ccAddresses: ccEmails,
      subject: intent.subject,
      body: intent.body,
    });
    return `✅ Correo enviado a ${emails.join(", ")}.`;
  }

  const spaces = loadNotionSpaces();
  const space = spaces[intent.space] || spaces["default"];
  if (!space) {
    return `⚠️ No encontre el espacio de Notion "${intent.space}" ni un espacio "default" configurado.`;
  }
  await createTask({
    space,
    title: intent.title,
    description: intent.description,
    assigneeName: intent.assignee_name,
    dueDate: intent.due_date,
  });
  return `✅ Tarea "${intent.title}" creada en Notion (${intent.space}).`;
}

export async function handleIncomingMessage(sock: WASocket, message: WAMessage): Promise<void> {
  const remoteJid = message.key.remoteJid;
  if (!remoteJid || remoteJid !== config.controlJid) return;

  const reply = (text: string) => sock.sendMessage(remoteJid, { text });

  const text = getMessageText(message);
  if (text) {
    const normalized = text.trim().toLowerCase();
    const pending = getPending(remoteJid);
    if (pending && CONFIRM_WORDS.includes(normalized)) {
      clearPending(remoteJid);
      await reply("⏳ Procesando...");
      try {
        const result = await executeIntent(pending.intent);
        await reply(result);
      } catch (err) {
        logger.error({ err }, "Error ejecutando la accion confirmada");
        await reply(`❌ Ocurrio un error ejecutando la accion: ${(err as Error).message}`);
      }
      return;
    }
    if (pending && CANCEL_WORDS.includes(normalized)) {
      clearPending(remoteJid);
      await reply("🚫 Accion cancelada.");
      return;
    }
    return;
  }

  const audioMessage = message.message?.audioMessage;
  if (!audioMessage) return;

  await reply("🎧 Escuchando tu audio...");

  let mp3Path: string | undefined;
  try {
    const buffer = (await downloadMediaMessage(message, "buffer", {})) as Buffer;
    mp3Path = await convertOggToMp3(buffer);

    const transcript = await transcribeAudio(mp3Path);
    logger.info({ transcript }, "Audio transcrito");

    const contacts = loadContacts();
    const spaces = loadNotionSpaces();
    const intent = await parseIntent(transcript, contacts, spaces);

    if (intent.action === "unknown") {
      await reply(
        `🤔 Transcribi: "${transcript}"\n\nNo logre identificar si es un correo o una tarea. ` +
          `Intenta ser mas especifico (ej. "envia un correo a Juan..." o "crea una tarea en marketing...").`
      );
      return;
    }

    if (config.requireConfirmation) {
      setPending(remoteJid, { intent, transcript, createdAt: Date.now() });
      await reply(await describeIntent(intent, contacts));
    } else {
      await reply(`🗣️ Transcribi: "${transcript}"\n⏳ Ejecutando...`);
      const result = await executeIntent(intent);
      await reply(result);
    }
  } catch (err) {
    logger.error({ err }, "Error procesando audio");
    await reply(`❌ Ocurrio un error procesando el audio: ${(err as Error).message}`);
  } finally {
    if (mp3Path && fs.existsSync(mp3Path)) {
      fs.unlinkSync(mp3Path);
    }
  }
}
