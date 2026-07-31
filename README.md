# Agente de Telegram + Zoho Mail + Notion

Agente personal que escucha notas de voz de Telegram, las transcribe, entiende si
quieres **enviar un correo** (a un cliente o a tu equipo, vía **Zoho Mail**) o
**crear una tarea de delegación** en un espacio de **Notion**, y ejecuta la acción
tras tu confirmación.

## Arquitectura

```
Telegram (bot)  →  Whisper (transcripción)  →  GPT (interpreta intención)
                                                      │
                                ┌─────────────────────┴─────────────────────┐
                                ▼                                           ▼
                         Zoho Mail API                                Notion API
                      (enviar correo)                          (crear tarea en un espacio)
```

- **Telegram**: [grammy](https://grammy.dev/) + Bot API oficial, en modo *long polling*
  (no requiere dominio, HTTPS ni servidor con IP pública).
- **Canal de control**: el agente solo procesa mensajes del `chat_id` configurado en
  `TELEGRAM_CHAT_ID` — normalmente el tuyo, para que nadie más pueda darle órdenes al bot.
- **Transcripción**: OpenAI Whisper.
- **Interpretación de la orden**: OpenAI (function calling) decide si es `send_email` o
  `create_task` y extrae los datos (destinatarios, asunto, cuerpo / espacio, título, asignado, fecha).
- **Confirmación**: por defecto (`REQUIRE_CONFIRMATION=true`), el agente te responde con un
  borrador y espera que contestes "sí" o "no" antes de enviar el correo o crear la tarea.

## Requisitos previos

- Node.js 20+ (o Docker).
- Una cuenta de Telegram (para crear el bot).
- Una cuenta de OpenAI con API key.
- Una cuenta de Zoho Mail.
- Un workspace de Notion.

## 1. Instalación

```bash
npm install
cp .env.example .env
cp config/contacts.example.json config/contacts.json
cp config/notion-spaces.example.json config/notion-spaces.json
```

## 2. Crear el bot de Telegram

1. Abre Telegram y busca **@BotFather**.
2. Envíale `/newbot`, dale un nombre y un usuario (debe terminar en `bot`, ej. `mi_agente_bot`).
3. BotFather te da un **token** (formato `123456789:AA...`). Ponlo en `.env` como
   `TELEGRAM_BOT_TOKEN`.
4. Envíale al menos un mensaje a tu nuevo bot desde tu cuenta de Telegram (para que Telegram
   registre la conversación).
5. Obtén tu `chat_id`: la forma más simple es escribirle a **@userinfobot** en Telegram, te
   responde con tu `Id`. Ponlo en `.env` como `TELEGRAM_CHAT_ID`.

## 3. Configurar OpenAI

Crea una API key en https://platform.openai.com/api-keys y ponla en `.env` como
`OPENAI_API_KEY`.

## 4. Configurar Zoho Mail (OAuth2)

Zoho Mail no usa API keys simples; usa OAuth2 con un *refresh token* de larga duración.

1. Ve a https://api-console.zoho.com/ y crea un cliente tipo **"Self Client"**.
2. En la pestaña "Generate Code", solicita un código con los scopes:
   `ZohoMail.messages.CREATE,ZohoMail.accounts.READ` y duración 10 minutos.
3. Copia el `client_id` y `client_secret` que te da la consola a tu `.env`
   (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`).
4. Intercambia el código generado por un `refresh_token` (dentro de los 10 minutos):

   ```bash
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "grant_type=authorization_code" \
     -d "client_id=TU_CLIENT_ID" \
     -d "client_secret=TU_CLIENT_SECRET" \
     -d "code=EL_CODIGO_GENERADO"
   ```

   La respuesta incluye `refresh_token`. Guárdalo en `ZOHO_REFRESH_TOKEN` (no expira salvo
   que lo revoques).
5. Obtén tu `accountId` numérico:

   ```bash
   curl -H "Authorization: Zoho-oauthtoken TU_ACCESS_TOKEN" \
     https://mail.zoho.com/api/accounts
   ```

   Copia el `accountId` a `ZOHO_ACCOUNT_ID` y tu dirección de correo a `ZOHO_FROM_ADDRESS`.
6. Si tu cuenta está en otra región (`.eu`, `.in`, etc.), ajusta `ZOHO_ACCOUNT_DOMAIN`.

## 5. Configurar Notion

1. Crea una integración en https://www.notion.so/my-integrations y copia el
   "Internal Integration Secret" a `NOTION_API_KEY`.
2. Para cada base de datos que quieras usar como "espacio" (ej. tareas personales,
   tareas de marketing, tareas del equipo), ábrela en Notion → menú `•••` →
   **"Add connections"** → selecciona tu integración.
3. Copia el ID de la base de datos (los 32 caracteres en la URL, antes de `?v=`).
4. Edita `config/notion-spaces.json`: por cada espacio define `database_id` y los nombres
   **exactos** de las propiedades de esa base de datos (título, asignado, fecha, estado).

## 6. Configurar contactos

Edita `config/contacts.json` mapeando el nombre que dirás por voz a un correo real:

```json
{
  "juan perez": { "email": "juan.perez@clienteempresa.com", "tipo": "cliente" }
}
```

## 7. Ejecutar en local (para probar)

```bash
npm run dev
```

Escríbele al bot en Telegram y envíale una nota de voz de prueba.

## 8. Dejarlo en línea 24/7

Este agente usa *long polling*: mientras el proceso esté corriendo, escucha mensajes.
Necesita quedar corriendo permanentemente en algún servidor — no funciona si solo lo
corres en tu laptop y la apagas. Opciones típicas, de más simple a más control:

- **Railway / Render / Fly.io**: subes el repo, defines las variables de entorno del
  `.env.example` en su panel, y ellos mantienen el proceso vivo. Es la opción más rápida
  para "quede online" sin administrar un servidor.
- **VPS propio** (DigitalOcean, Hetzner, etc.) con Docker:

  ```bash
  docker compose up -d --build
  docker compose logs -f
  ```

  `restart: unless-stopped` en `docker-compose.yml` hace que se reinicie solo si el
  servidor reinicia o el proceso se cae.

### Qué necesito de ti para dejarlo desplegado

Yo (el agente de código) puedo preparar y ajustar todo el código, pero **no tengo dónde
correr el proceso 24/7 por ti** — esta sesión es temporal. Para dejarlo online necesito
que me des uno de estos dos:

1. **Acceso a un VPS** (IP + usuario/SSH, o acceso a un panel tipo DigitalOcean) donde
   pueda instalar Docker y desplegar el contenedor, **o**
2. **Acceso a una cuenta en un servicio de hosting** (Railway, Render, Fly.io, etc.) donde
   pueda conectar este repositorio y configurar las variables de entorno.

Además, en cualquiera de los dos casos, necesito que tú generes y me compartas (o los
cargues directamente en el panel del hosting, sin pasármelos a mí) estos valores para el
`.env`:

- `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`
- `OPENAI_API_KEY`
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`, `ZOHO_FROM_ADDRESS`
- `NOTION_API_KEY`
- `config/contacts.json` y `config/notion-spaces.json` completos con tus datos reales

Por seguridad, lo ideal es que **tú mismo** cargues esas credenciales directamente en las
variables de entorno del servidor/servicio de hosting (nunca las subas al repositorio de
git ni las pegues en el chat).

## 9. Uso

1. Abre el chat con tu bot en Telegram.
2. Envía una nota de voz, por ejemplo:
   - *"Mándale un correo a Juan Pérez confirmando la reunión del jueves a las 10am"*
   - *"Crea una tarea en marketing para que María prepare el reporte mensual, para el viernes"*
3. El agente responde con el borrador (correo o tarea) y espera tu confirmación.
4. Responde **"sí"** para ejecutar o **"no"** para cancelar.

Si prefieres que ejecute directo sin pedir confirmación, pon `REQUIRE_CONFIRMATION=false`
en `.env` (no recomendado para el envío de correos).

## Notas y limitaciones

- El emparejamiento de nombres a correos/asignados es exacto por ahora (case-insensitive).
  Si dictas un nombre que no está en `config/contacts.json`, el agente te avisará en vez
  de adivinar.
- Las credenciales (`.env`, `config/contacts.json`, `config/notion-spaces.json`) están en
  `.gitignore` — nunca deben subirse al repositorio.
- El estado de "acción pendiente de confirmación" vive en memoria del proceso; si el
  proceso se reinicia mientras esperas confirmar, tendrás que volver a dictar el audio.
