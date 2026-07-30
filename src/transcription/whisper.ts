import fs from "fs";
import OpenAI from "openai";
import { config } from "../config";

const client = new OpenAI({ apiKey: config.openai.apiKey });

export async function transcribeAudio(mp3Path: string): Promise<string> {
  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(mp3Path),
    model: config.openai.transcribeModel,
    language: "es",
  });
  return response.text.trim();
}
