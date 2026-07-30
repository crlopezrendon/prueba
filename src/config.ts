import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ContactsMap, NotionSpacesMap } from "./types";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

function readJsonFile<T>(filePath: string, label: string): T {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `No se encontro el archivo de ${label} en ${resolved}. ` +
        `Copia el .example.json correspondiente y completalo (ver README).`
    );
  }
  return JSON.parse(fs.readFileSync(resolved, "utf-8"));
}

export const config = {
  controlJid: required("CONTROL_JID"),
  whatsappAuthDir: process.env.WHATSAPP_AUTH_DIR || "./auth",
  requireConfirmation: (process.env.REQUIRE_CONFIRMATION ?? "true") === "true",

  openai: {
    apiKey: required("OPENAI_API_KEY"),
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
    nluModel: process.env.OPENAI_NLU_MODEL || "gpt-4o-mini",
  },

  zoho: {
    clientId: required("ZOHO_CLIENT_ID"),
    clientSecret: required("ZOHO_CLIENT_SECRET"),
    refreshToken: required("ZOHO_REFRESH_TOKEN"),
    accountDomain: process.env.ZOHO_ACCOUNT_DOMAIN || "zoho.com",
    accountId: required("ZOHO_ACCOUNT_ID"),
    fromAddress: required("ZOHO_FROM_ADDRESS"),
  },

  notion: {
    apiKey: required("NOTION_API_KEY"),
  },

  contactsFile: process.env.CONTACTS_FILE || "./config/contacts.json",
  notionSpacesFile: process.env.NOTION_SPACES_FILE || "./config/notion-spaces.json",
};

export function loadContacts(): ContactsMap {
  return readJsonFile<ContactsMap>(config.contactsFile, "contactos");
}

export function loadNotionSpaces(): NotionSpacesMap {
  return readJsonFile<NotionSpacesMap>(config.notionSpacesFile, "espacios de Notion");
}
