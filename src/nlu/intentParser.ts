import OpenAI from "openai";
import { config } from "../config";
import { ContactsMap, NotionSpacesMap, ParsedIntent } from "../types";

const client = new OpenAI({ apiKey: config.openai.apiKey });

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Redacta y envia un correo a uno o mas destinatarios (clientes o equipo).",
      parameters: {
        type: "object",
        properties: {
          to_names: {
            type: "array",
            items: { type: "string" },
            description: "Nombres de los destinatarios tal como los menciono el usuario.",
          },
          cc_names: {
            type: "array",
            items: { type: "string" },
            description: "Nombres en copia (CC), si se mencionan.",
          },
          subject: { type: "string", description: "Asunto del correo." },
          body: {
            type: "string",
            description:
              "Cuerpo del correo redactado de forma profesional y clara, a partir de lo dictado.",
          },
        },
        required: ["to_names", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crea una tarea de delegacion en un espacio de Notion.",
      parameters: {
        type: "object",
        properties: {
          space: {
            type: "string",
            description:
              "Espacio/area de Notion donde va la tarea (ej. 'default', 'marketing'). Usa 'default' si no se especifica.",
          },
          title: { type: "string", description: "Titulo corto de la tarea." },
          description: { type: "string", description: "Detalle adicional de la tarea." },
          assignee_name: {
            type: "string",
            description: "Nombre de la persona a quien se delega la tarea, si se menciona.",
          },
          due_date: {
            type: "string",
            description: "Fecha limite en formato YYYY-MM-DD, si se menciona o se puede inferir.",
          },
        },
        required: ["space", "title"],
      },
    },
  },
];

function buildSystemPrompt(contacts: ContactsMap, spaces: NotionSpacesMap): string {
  const contactNames = Object.keys(contacts).join(", ") || "(sin contactos configurados)";
  const spaceNames = Object.keys(spaces).join(", ") || "default";
  return [
    "Eres el asistente que interpreta ordenes dictadas por voz de un usuario de negocio.",
    "El usuario dicta en espanol lo que quiere hacer: enviar un correo (a clientes o equipo) o crear una tarea de delegacion en Notion.",
    `Contactos conocidos: ${contactNames}.`,
    `Espacios de Notion conocidos: ${spaceNames}.`,
    "Debes llamar exactamente a una funcion (send_email o create_task) que mejor represente la intencion.",
    "Si el texto no corresponde claramente a ninguna de las dos acciones, no llames ninguna funcion.",
  ].join("\n");
}

export async function parseIntent(
  transcript: string,
  contacts: ContactsMap,
  spaces: NotionSpacesMap
): Promise<ParsedIntent> {
  const completion = await client.chat.completions.create({
    model: config.openai.nluModel,
    messages: [
      { role: "system", content: buildSystemPrompt(contacts, spaces) },
      { role: "user", content: transcript },
    ],
    tools,
    tool_choice: "auto",
  });

  const toolCall = completion.choices[0]?.message.tool_calls?.[0];
  if (!toolCall) {
    return {
      action: "unknown",
      reason: "No se pudo identificar si es un correo o una tarea a partir del audio.",
    };
  }

  const args = JSON.parse(toolCall.function.arguments);

  if (toolCall.function.name === "send_email") {
    return {
      action: "send_email",
      to_names: args.to_names || [],
      cc_names: args.cc_names || [],
      subject: args.subject,
      body: args.body,
    };
  }

  if (toolCall.function.name === "create_task") {
    return {
      action: "create_task",
      space: args.space || "default",
      title: args.title,
      description: args.description,
      assignee_name: args.assignee_name,
      due_date: args.due_date,
    };
  }

  return { action: "unknown", reason: "Funcion no reconocida." };
}
