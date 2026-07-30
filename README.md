# Agente de WhatsApp + Zoho Mail + Notion

Agente personal que escucha notas de voz de WhatsApp, las transcribe, entiende si
quieres **enviar un correo** (a un cliente o a tu equipo, vía **Zoho Mail**) o
**crear una tarea de delegación** en un espacio de **Notion**, y ejecuta la acción
tras tu confirmación.

## Arquitectura

```
WhatsApp (Baileys)  →  Whisper (transcripción)  →  GPT (interpreta intención)
                                                          │
                                    ┌─────────────────────┴─────────────────────┐
                                    ▼                                           ▼
                             Zoho Mail API                                Notion API
                          (enviar correo)                          (crear tarea en un espacio)
```

- **WhatsApp**: [Baileys](https://github.com/WhiskeySockets/Baileys) (librería no oficial), te
  conectas con tu propio número escaneando un QR — no requiere aprobación de Meta Business.
- **Canal de control**: el agente solo procesa mensajes del chat configurado en `CONTROL_JID`.
  Se recomienda usar tu chat de **"Mensajes a ti mismo"** en WhatsApp para no mezclar el
  agente con tus conversaciones reales con clientes o equipo.
- **Transcripción**: OpenAI Whisper.
- **Interpretación de la orden**: OpenAI (function calling) decide si es `send_email` o
  `create_task` y extrae los datos (destinatarios, asunto, cuerpo / espacio, título, asignado, fecha).
- **Confirmación**: por defecto (`REQUIRE_CONFIRMATION=true`), el agente te responde con un
  borrador y espera que contestes "sí" o "no" antes de enviar el correo o crear la tarea.

## Requisitos previos

- Node.js 20+ (o Docker).
- Una cuenta de OpenAI con API key.
- Una cuenta de Zoho Mail.
- Un workspace de Notion.
- Un número de WhatsApp que puedas vincular como "dispositivo vinculado".

## 1. Instalación

```bash
npm install
cp .env.example .env
cp config/contacts.example.json config/contacts.json
cp config/notion-spaces.example.json config/notion-spaces.json
```

## 2. Configurar OpenAI

Crea una API key en https://platform.openai.com/api-keys y ponla en `.env` como
`OPENAI_API_KEY`.

## 3. Configurar Zoho Mail (OAuth2)

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

## 4. Configurar Notion

1. Crea una integración en https://www.notion.so/my-integrations y copia el
   "Internal Integration Secret" a `NOTION_API_KEY`.
2. Para cada base de datos que quieras usar como "espacio" (ej. tareas personales,
   tareas de marketing, tareas del equipo), ábrela en Notion → menú `•••` →
   **"Add connections"** → selecciona tu integración.
3. Copia el ID de la base de datos (los 32 caracteres en la URL, antes de `?v=`).
4. Edita `config/notion-spaces.json`: por cada espacio define `database_id` y los nombres
   **exactos** de las propiedades de esa base de datos (título, asignado, fecha, estado).

## 5. Configurar contactos

Edita `config/contacts.json` mapeando el nombre que dirás por voz a un correo real:

```json
{
  "juan perez": { "email": "juan.perez@clienteempresa.com", "tipo": "cliente" }
}
```

## 6. Configurar el canal de control (`CONTROL_JID`)

Es el JID de WhatsApp que el agente va a escuchar, formato `<numero_con_codigo_pais>@s.whatsapp.net`
(ej. `521XXXXXXXXXX@s.whatsapp.net`). Usa tu propio número si vas a dictarle
al chat "Mensajes a ti mismo". La primera vez que el bot reciba un mensaje de un JID nuevo,
verás el JID exacto en los logs si quieres confirmarlo.

## 7. Ejecutar

### Local

```bash
npm run dev
```

### Docker

```bash
docker compose up -d --build
docker compose logs -f
```

La primera vez se mostrará un **código QR en la terminal**. Escanéalo desde
WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo. La sesión se
guarda en la carpeta `auth/` (no la borres ni la subas a git).

## 8. Uso

1. Abre el chat "Mensajes a ti mismo" (o el número que configuraste como `CONTROL_JID`).
2. Envía una nota de voz, por ejemplo:
   - *"Mándale un correo a Juan Pérez confirmando la reunión del jueves a las 10am"*
   - *"Crea una tarea en marketing para que María prepare el reporte mensual, para el viernes"*
3. El agente responde con el borrador (correo o tarea) y espera tu confirmación.
4. Responde **"sí"** para ejecutar o **"no"** para cancelar.

Si prefieres que ejecute directo sin pedir confirmación, pon `REQUIRE_CONFIRMATION=false`
en `.env` (no recomendado para el envío de correos).

## Notas y limitaciones

- **Baileys es una librería no oficial**: automatiza tu cuenta normal de WhatsApp. Úsalo
  bajo tu propio criterio; si prefieres la vía oficial, se puede migrar la capa de
  `src/whatsapp/` a la [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
  de Meta sin tocar el resto del pipeline (transcripción, NLU, Zoho, Notion).
- El emparejamiento de nombres a correos/asignados es exacto por ahora (case-insensitive).
  Si dictas un nombre que no está en `config/contacts.json`, el agente te avisará en vez
  de adivinar.
- Las credenciales (`.env`, `auth/`, `config/contacts.json`, `config/notion-spaces.json`)
  están en `.gitignore` — nunca deben subirse al repositorio.
