import { startWhatsApp } from "./whatsapp/client";
import { handleIncomingMessage } from "./whatsapp/messageHandler";
import { logger } from "./logger";

async function main() {
  logger.info("Iniciando agente de WhatsApp...");
  await startWhatsApp(handleIncomingMessage);
}

main().catch((err) => {
  logger.error({ err }, "Error fatal iniciando el agente");
  process.exit(1);
});
