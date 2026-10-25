import { sessionKey, type SessionDriverEvent, type SessionRef } from "@pi-gui/session-driver";
import type { DesktopAppState, TranscriptMessage } from "../../contracts/desktop-state";

interface DeliveryHost {
  transcriptFor(ref: SessionRef): readonly TranscriptMessage[];
  getSessionError(ref: SessionRef): string | undefined;
  getQueuedComposerMessages(ref: SessionRef): readonly unknown[];
  subscribeToSessionEvents(listener: (event: SessionDriverEvent) => void): () => void;
  submitComposerToSession(
    ref: SessionRef,
    text: string,
    attachments: readonly [],
    options: { readonly deliverAs: "followUp"; readonly allowCommands: false },
  ): Promise<DesktopAppState>;
}

/** Cancellation releases the caller, not the receiver. Never retry an uncertain delivery. */
export function acknowledgeThreadMessage(
  host: DeliveryHost,
  ref: SessionRef,
  text: string,
  signal?: AbortSignal,
  timing = { timeoutMs: 10_000, failureGraceMs: 1_000 },
): Promise<"sent" | "queued"> {
  if (signal?.aborted)
    return Promise.reject(new Error("Message send cancelled before submission."));
  const oldIds = new Set(host.transcriptFor(ref).map((item) => item.id));
  return new Promise((resolve, reject) => {
    let settled = false;
    let acknowledged = false;
    let grace: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    const uncertain = (reason: string) =>
      new Error(
        `${reason} Delivery may already have occurred; inspect the target before retrying. Its work was not stopped.`,
      );
    const timeout = setTimeout(
      () => finish(uncertain("Message delivery acknowledgement timed out.")),
      timing.timeoutMs,
    );
    const abort = () => finish(uncertain("Message send wait cancelled."));
    function finish(result: "sent" | "queued" | Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (grace) clearTimeout(grace);
      unsubscribe();
      signal?.removeEventListener("abort", abort);
      if (result instanceof Error) reject(result);
      else resolve(result);
    }
    unsubscribe = host.subscribeToSessionEvents((event) => {
      if (sessionKey(event.sessionRef) !== sessionKey(ref)) return;
      if (event.type === "runFailed") {
        finish(new Error(`Message delivery/run failed: ${event.error.message}`));
      } else if (event.type === "sessionClosed") {
        finish(uncertain("Target session closed before acknowledgement."));
      } else if (event.type === "sessionUpdated" && event.snapshot.status === "running") {
        if (grace) return;
        // A previous turn or an optimistic UI row is not delivery evidence. Require
        // a driver running snapshot AND a newly appended matching user message.
        const hasNewMessage = host
          .transcriptFor(ref)
          .some(
            (item) =>
              !oldIds.has(item.id) &&
              item.kind === "message" &&
              item.role === "user" &&
              item.text === text.trim(),
          );
        if (hasNewMessage && !grace) {
          acknowledged = true;
          grace = setTimeout(() => {
            const error = host.getSessionError(ref);
            finish(error ? new Error(error) : "sent");
          }, timing.failureGraceMs);
        }
      }
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      finish(new Error("Message send cancelled before submission."));
      return;
    }
    // Keep observing rejection after early return. The composer/driver owns the
    // receiver's ongoing error state; releasing this wait never cancels its run.
    let submission: Promise<DesktopAppState>;
    try {
      submission = host.submitComposerToSession(ref, text, [], {
        deliverAs: "followUp",
        allowCommands: false,
      });
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    void submission.then(
      () => {
        if (settled) return;
        const error = host.getSessionError(ref);
        if (error) finish(new Error(`Message delivery/run failed: ${error}`));
        else if (host.getQueuedComposerMessages(ref).length) finish("queued");
        else if (acknowledged) finish("sent");
        else finish(uncertain("Message submission returned without delivery evidence."));
      },
      (error: unknown) => finish(error instanceof Error ? error : new Error(String(error))),
    );
  });
}
