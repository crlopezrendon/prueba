import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

/**
 * Las notas de voz de Telegram llegan como OGG/Opus. Whisper no soporta ese
 * contenedor de forma confiable, asi que se convierte a mp3 antes de transcribir.
 */
export async function convertOggToMp3(oggPath: string): Promise<string> {
  const outputPath = path.join(os.tmpdir(), `${randomUUID()}.mp3`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(oggPath)
      .toFormat("mp3")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });

  return outputPath;
}
