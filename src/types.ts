export interface Contact {
  email: string;
  tipo?: string;
}

export type ContactsMap = Record<string, Contact>;

export interface NotionSpace {
  database_id: string;
  title_property: string;
  assignee_property?: string;
  due_date_property?: string;
  status_property?: string;
  default_status?: string;
}

export type NotionSpacesMap = Record<string, NotionSpace>;

export interface SendEmailIntent {
  action: "send_email";
  to_names: string[];
  cc_names?: string[];
  subject: string;
  body: string;
}

export interface CreateTaskIntent {
  action: "create_task";
  space: string;
  title: string;
  description?: string;
  assignee_name?: string;
  due_date?: string;
}

export type ParsedIntent =
  | SendEmailIntent
  | CreateTaskIntent
  | { action: "unknown"; reason: string };

export interface PendingAction {
  intent: SendEmailIntent | CreateTaskIntent;
  transcript: string;
  createdAt: number;
}
