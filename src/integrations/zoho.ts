import axios from "axios";
import { config } from "../config";
import { logger } from "../logger";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const url = `https://accounts.${config.zoho.accountDomain}/oauth/v2/token`;
  const response = await axios.post(url, null, {
    params: {
      refresh_token: config.zoho.refreshToken,
      client_id: config.zoho.clientId,
      client_secret: config.zoho.clientSecret,
      grant_type: "refresh_token",
    },
  });

  const { access_token, expires_in } = response.data;
  cachedToken = {
    accessToken: access_token,
    expiresAt: Date.now() + expires_in * 1000,
  };
  return access_token;
}

export interface SendEmailParams {
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  body: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const accessToken = await getAccessToken();
  const url = `https://mail.${config.zoho.accountDomain}/api/accounts/${config.zoho.accountId}/messages`;

  await axios.post(
    url,
    {
      fromAddress: config.zoho.fromAddress,
      toAddress: params.toAddresses.join(","),
      ccAddress: params.ccAddresses?.join(",") || undefined,
      subject: params.subject,
      content: params.body.replace(/\n/g, "<br/>"),
      mailFormat: "html",
    },
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  logger.info({ to: params.toAddresses, subject: params.subject }, "Correo enviado via Zoho Mail");
}
