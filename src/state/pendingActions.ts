import { PendingAction } from "../types";

const PENDING_TTL_MS = 10 * 60 * 1000;

const pendingByJid = new Map<string, PendingAction>();

export function setPending(jid: string, action: PendingAction): void {
  pendingByJid.set(jid, action);
}

export function getPending(jid: string): PendingAction | undefined {
  const pending = pendingByJid.get(jid);
  if (!pending) return undefined;
  if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
    pendingByJid.delete(jid);
    return undefined;
  }
  return pending;
}

export function clearPending(jid: string): void {
  pendingByJid.delete(jid);
}
