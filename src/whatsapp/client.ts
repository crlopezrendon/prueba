import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { config } from "../config";
import { logger } from "../logger";

export async function startWhatsApp(
  onMessage: (sock: WASocket, message: any) => Promise<void>
): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.whatsappAuthDir);

  const sock = makeWASocket({
    auth: state,
    logger: logger.child({ module: "baileys" }) as any,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Escanea este QR con WhatsApp (Dispositivos vinculados):");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode }, "Conexion de WhatsApp cerrada");
      if (shouldReconnect) {
        startWhatsApp(onMessage);
      } else {
        logger.error("Sesion cerrada. Borra la carpeta de auth y vuelve a escanear el QR.");
      }
    } else if (connection === "open") {
      logger.info("Conectado a WhatsApp correctamente.");
    }
  });

  sock.ev.on("messages.upsert", async (event) => {
    for (const message of event.messages) {
      try {
        await onMessage(sock, message);
      } catch (err) {
        logger.error({ err }, "Error procesando mensaje entrante");
      }
    }
  });

  return sock;
}
