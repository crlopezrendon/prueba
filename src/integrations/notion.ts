import { Client } from "@notionhq/client";
import { config } from "../config";
import { logger } from "../logger";
import { NotionSpace } from "../types";

const notion = new Client({ auth: config.notion.apiKey });

export interface CreateTaskParams {
  space: NotionSpace;
  title: string;
  description?: string;
  assigneeName?: string;
  dueDate?: string;
}

export async function createTask(params: CreateTaskParams): Promise<string> {
  const { space } = params;

  const properties: Record<string, any> = {
    [space.title_property]: {
      title: [{ text: { content: params.title } }],
    },
  };

  if (space.status_property && space.default_status) {
    properties[space.status_property] = { status: { name: space.default_status } };
  }

  if (space.assignee_property && params.assigneeName) {
    properties[space.assignee_property] = {
      rich_text: [{ text: { content: params.assigneeName } }],
    };
  }

  if (space.due_date_property && params.dueDate) {
    properties[space.due_date_property] = { date: { start: params.dueDate } };
  }

  const children = params.description
    ? [
        {
          object: "block" as const,
          type: "paragraph" as const,
          paragraph: { rich_text: [{ type: "text" as const, text: { content: params.description } }] },
        },
      ]
    : undefined;

  const page = await notion.pages.create({
    parent: { database_id: space.database_id },
    properties,
    children,
  });

  logger.info({ title: params.title, pageId: page.id }, "Tarea creada en Notion");
  return page.id;
}
