# Desplegar en Oracle Cloud (Always Free)

Guía paso a paso para dejar el agente corriendo 24/7 gratis en una VM ARM
"Always Free" de Oracle Cloud Infrastructure (OCI). Como el bot usa *long
polling* de Telegram (no webhooks), **no necesitas abrir ningún puerto de
entrada** más que el SSH — eso simplifica bastante la parte de firewall.

## Parte 1 — Crear la cuenta y la VM

1. Crea una cuenta en https://www.oracle.com/cloud/free/. Piden una tarjeta
   para verificar identidad, pero **no cobra nada** mientras te quedes dentro
   de los límites "Always Free". Elige bien la región al crear la cuenta: no
   se puede cambiar después (elige la más cercana a ti).
2. En la consola de OCI: **Compute → Instances → Create Instance**.
   - **Name**: `telegram-agent` (o el que quieras).
   - **Image**: Canonical Ubuntu (22.04 o 24.04) — elegible Always Free.
   - **Shape**: click "Change shape" → pestaña **Ampere** → `VM.Standard.A1.Flex`.
     Con 1 OCPU / 6 GB RAM sobra para este bot (el límite Always Free actual
     es hasta 2 OCPU / 12 GB en total, así que dejas margen para otra cosa).
   - **Networking**: deja la VCN por defecto que te propone el asistente
     (crea una subred pública y te asigna una IP pública automáticamente).
   - **SSH keys**: elige "Generate a key pair for me" y **descarga la clave
     privada** (`.key`) — la vas a necesitar para conectarte. Guárdala bien,
     no se puede volver a descargar.
   - **Boot volume**: el valor por defecto (~50GB) es elegible Always Free.
   - Click **Create** y espera a que el estado pase a "Running".
3. Copia la **IP pública** de la instancia (aparece en la página de detalle).

## Parte 2 — Conectarte por SSH

Desde tu computadora (Mac/Linux/WSL):

```bash
chmod 600 ruta/a/tu-clave-privada.key
ssh -i ruta/a/tu-clave-privada.key ubuntu@TU_IP_PUBLICA
```

(El usuario es `ubuntu` si elegiste la imagen de Ubuntu.)

## Parte 3 — Instalar Docker

Ya conectado por SSH a la VM:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Verifica que funcione: `docker run hello-world`.

## Parte 4 — Clonar el repositorio

```bash
git clone -b claude/whatsapp-agent-zoho-notion-0e1ljx https://github.com/crlopezrendon/prueba.git telegram-agent
cd telegram-agent
```

> Si el repositorio es privado, en vez de la URL normal usa un [Personal
> Access Token](https://github.com/settings/tokens) de GitHub:
> `git clone -b claude/whatsapp-agent-zoho-notion-0e1ljx https://TU_TOKEN@github.com/crlopezrendon/prueba.git telegram-agent`

## Parte 5 — Configurar credenciales

```bash
cp .env.example .env
nano .env
```

Completa **todos** los valores (Telegram, OpenAI, Zoho, Notion) siguiendo la
guía del `README.md` de este mismo repo. Guarda con `Ctrl+O`, `Enter`, y sal
con `Ctrl+X`.

```bash
cp config/contacts.example.json config/contacts.json
nano config/contacts.json
cp config/notion-spaces.example.json config/notion-spaces.json
nano config/notion-spaces.json
```

## Parte 6 — Levantar el bot

```bash
docker compose up -d --build
docker compose logs -f
```

Deberías ver algo como `Bot de Telegram conectado (long polling).`. Sal del
seguimiento de logs con `Ctrl+C` — el contenedor sigue corriendo en segundo
plano.

Prueba enviándole una nota de voz a tu bot en Telegram.

## Parte 7 — Que sobreviva a reinicios del servidor

`docker-compose.yml` ya tiene `restart: unless-stopped`, así que el
contenedor se reinicia solo si se cae o si el servidor reinicia — siempre y
cuando el **servicio de Docker** también arranque solo al bootear, lo cual
ya viene habilitado por defecto tras la instalación. Puedes confirmarlo con:

```bash
sudo systemctl is-enabled docker
```

## Mantenimiento del día a día

- **Ver logs**: `docker compose logs -f --tail 100`
- **Reiniciar el bot**: `docker compose restart`
- **Actualizar el código** (después de hacer cambios en el repo):
  ```bash
  git pull
  docker compose up -d --build
  ```
- **Apagarlo**: `docker compose down`
- **Editar contactos o espacios de Notion**: edita `config/contacts.json` o
  `config/notion-spaces.json` y corre `docker compose restart` (no hace
  falta reconstruir la imagen para esto).

## Seguridad recomendada

- No abras más puertos de los necesarios: por defecto solo el 22 (SSH) está
  abierto, y este bot no necesita nada más entrante.
- Opcional pero recomendado, protección contra fuerza bruta por SSH:
  ```bash
  sudo apt install -y fail2ban
  ```
- Mantén el sistema actualizado periódicamente: `sudo apt update && sudo apt upgrade -y`.
- Nunca subas `.env`, `config/contacts.json` ni `config/notion-spaces.json`
  al repositorio (ya están en `.gitignore`).

## Uso diario del agente (recordatorio)

1. Abre el chat con tu bot en Telegram.
2. Envía una nota de voz, por ejemplo:
   - *"Mándale un correo a Juan Pérez confirmando la reunión del jueves a las 10am"*
   - *"Crea una tarea en marketing para que María prepare el reporte mensual, para el viernes"*
3. El bot responde con el borrador (correo o tarea).
4. Contesta **"sí"** para ejecutarlo o **"no"** para cancelarlo.
