export const THREAD_MESSAGE_PREFIX = "[pi-gui thread message ";

/** Compact display only. The persisted prompt retains provenance and routing constraints. */
export function threadMessageDisplayText(text: string): string {
  if (!text.startsWith(THREAD_MESSAGE_PREFIX)) return text;
  const separator = text.indexOf("\n\n");
  if (separator < 0) return text;
  const header = text.slice(0, separator);
  const project = header
    .split("\n")
    .find((line) => line.startsWith("From project: "))
    ?.slice("From project: ".length);
  const name = project?.split(/[\\/]/).filter(Boolean).pop();
  return `${name ? `Message from project "${name}"` : "Message from another thread"}\n\n${text.slice(separator + 2)}`;
}
