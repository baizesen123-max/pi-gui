import { readJsonWithBackup, writeFileAtomicQueued } from "../persistence/atomic-file-write";
import type { ThreadReceipt } from "./thread-mailbox";

function validateReceipts(value: unknown): ThreadReceipt[] {
  if (!Array.isArray(value)) throw new Error("Invalid thread receipt file; delivery stopped.");
  const statuses = new Set([
    "submitting",
    "queued",
    "running",
    "turn_finished",
    "failed",
    "cancelled",
    "unknown",
  ]);
  for (const item of value as unknown[]) {
    if (!item || typeof item !== "object") throw new Error("Invalid thread receipt");
    const r = item as Partial<ThreadReceipt>;
    if (
      typeof r.id !== "string" ||
      typeof r.fingerprint !== "string" ||
      typeof r.createdAt !== "string" ||
      !statuses.has(r.status ?? "") ||
      !r.source ||
      typeof r.source.workspaceId !== "string" ||
      typeof r.source.sessionId !== "string" ||
      !r.target ||
      typeof r.target.workspaceId !== "string" ||
      typeof r.target.sessionId !== "string" ||
      (r.error !== undefined && typeof r.error !== "string")
    )
      throw new Error("Invalid thread receipt");
  }
  return value as ThreadReceipt[];
}

export async function readThreadReceipts(file: string): Promise<ThreadReceipt[]> {
  const saved = await readJsonWithBackup(file);
  if (saved.corrupted && !saved.recovered)
    throw new Error("Thread receipt file is corrupted; preserved it and refused delivery.");
  return saved.value === undefined ? [] : validateReceipts(saved.value);
}
export function writeThreadReceipts(
  file: string,
  receipts: readonly ThreadReceipt[],
): Promise<void> {
  return writeFileAtomicQueued(file, JSON.stringify(receipts), validateReceipts);
}
