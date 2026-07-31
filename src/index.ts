import { startTelegram } from "./telegram/client";
import { registerHandlers } from "./telegram/messageHandler";
import { logger } from "./logger";

async function main() {
  logger.info("Iniciando agente de Telegram...");
  startTelegram(registerHandlers);
}

main().catch((err) => {
  logger.error({ err }, "Error fatal iniciando el agente");
  process.exit(1);
});
