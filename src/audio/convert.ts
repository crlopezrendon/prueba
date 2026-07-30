import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

/**
 * Los audios de WhatsApp llegan como OGG/Opus. Whisper no soporta ese
 * contenedor de forma confiable, asi que se convierte a mp3 antes de transcribir.
 */
export async function convertOggToMp3(oggBuffer: Buffer): Promise<string> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${randomUUID()}.ogg`);
  const outputPath = path.join(tmpDir, `${randomUUID()}.mp3`);

  fs.writeFileSync(inputPath, oggBuffer);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp3")
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });

  fs.unlinkSync(inputPath);
  return outputPath;
}
