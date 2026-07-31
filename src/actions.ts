import { loadContacts, loadNotionSpaces } from "./config";
import { sendEmail } from "./integrations/zoho";
import { createTask } from "./integrations/notion";
import { CreateTaskIntent, SendEmailIntent } from "./types";

function resolveEmails(
  names: string[],
  contacts: ReturnType<typeof loadContacts>
): { emails: string[]; unresolved: string[] } {
  const emails: string[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const contact = contacts[name.trim().toLowerCase()];
    if (contact) {
      emails.push(contact.email);
    } else {
      unresolved.push(name);
    }
  }
  return { emails, unresolved };
}

export function describeIntent(
  intent: SendEmailIntent | CreateTaskIntent
): string {
  if (intent.action === "send_email") {
    return (
      `📧 *Borrador de correo*\n` +
      `Para: ${intent.to_names.join(", ")}\n` +
      (intent.cc_names?.length ? `CC: ${intent.cc_names.join(", ")}\n` : "") +
      `Asunto: ${intent.subject}\n\n${intent.body}\n\n` +
      `Responde *sí* para enviarlo o *no* para cancelar.`
    );
  }
  return (
    `📝 *Nueva tarea en Notion (${intent.space})*\n` +
    `Titulo: ${intent.title}\n` +
    (intent.assignee_name ? `Asignado a: ${intent.assignee_name}\n` : "") +
    (intent.due_date ? `Fecha limite: ${intent.due_date}\n` : "") +
    (intent.description ? `Detalle: ${intent.description}\n` : "") +
    `\nResponde *sí* para crearla o *no* para cancelar.`
  );
}

export async function executeIntent(
  intent: SendEmailIntent | CreateTaskIntent
): Promise<string> {
  const contacts = loadContacts();

  if (intent.action === "send_email") {
    const { emails, unresolved } = resolveEmails(intent.to_names, contacts);
    if (unresolved.length > 0 || emails.length === 0) {
      return (
        `⚠️ No encontre en tus contactos a: ${unresolved.join(", ") || "el destinatario"}. ` +
        `Agregalos en config/contacts.json e intenta de nuevo.`
      );
    }
    const { emails: ccEmails } = resolveEmails(intent.cc_names || [], contacts);
    await sendEmail({
      toAddresses: emails,
      ccAddresses: ccEmails,
      subject: intent.subject,
      body: intent.body,
    });
    return `✅ Correo enviado a ${emails.join(", ")}.`;
  }

  const spaces = loadNotionSpaces();
  const space = spaces[intent.space] || spaces["default"];
  if (!space) {
    return `⚠️ No encontre el espacio de Notion "${intent.space}" ni un espacio "default" configurado.`;
  }
  await createTask({
    space,
    title: intent.title,
    description: intent.description,
    assigneeName: intent.assignee_name,
    dueDate: intent.due_date,
  });
  return `✅ Tarea "${intent.title}" creada en Notion (${intent.space}).`;
}
