import { createOrchestrationRuntimeTools } from "../../electron/orchestration/orchestration-runtime";
import { expect, test } from "@playwright/test";
import type { SessionDriverEvent } from "@pi-gui/session-driver";
import type { DesktopAppState, TranscriptMessage } from "../../contracts/desktop-state";
import { acknowledgeThreadMessage } from "../../electron/orchestration/thread-message-delivery";

const ref = { workspaceId: "ws", sessionId: "child" };
const timestamp = "2026-10-25T00:00:00.000Z";
function fixture() {
  let listener: ((event: SessionDriverEvent) => void) | undefined;
  let error: string | undefined;
  let queued: unknown[] = [];
  let submissions = 0;
  let resolve!: (state: DesktopAppState) => void;
  let reject!: (error: Error) => void;
  const submission = new Promise<DesktopAppState>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const transcript: TranscriptMessage[] = [
    { kind: "message", id: "old", role: "user", text: "hello", createdAt: timestamp },
  ];
  const host: Parameters<typeof acknowledgeThreadMessage>[0] = {
    transcriptFor: () => transcript,
    getSessionError: () => error,
    getQueuedComposerMessages: () => queued,
    subscribeToSessionEvents: (callback) => {
      listener = callback;
      return () => {
        listener = undefined;
      };
    },
    submitComposerToSession: () => {
      submissions++;
      return submission;
    },
  };
  return {
    send: (signal?: AbortSignal) =>
      acknowledgeThreadMessage(host, ref, "hello", signal, { timeoutMs: 1000, failureGraceMs: 1 }),
    timeout: () =>
      acknowledgeThreadMessage(host, ref, "hello", undefined, { timeoutMs: 1, failureGraceMs: 1 }),
    append: () =>
      transcript.push({
        kind: "message",
        id: "new",
        role: "user",
        text: "hello",
        createdAt: timestamp,
      }),
    running: (sessionId = "child") =>
      listener?.({
        type: "sessionUpdated",
        sessionRef: { ...ref, sessionId },
        timestamp,
        snapshot: {
          ref,
          workspace: { workspaceId: "ws", path: "/tmp", displayName: "tmp" },
          title: "child",
          status: "running",
          updatedAt: timestamp,
          runningRunId: "new-run",
        },
      }),
    fail: () =>
      listener?.({
        type: "runFailed",
        sessionRef: ref,
        timestamp,
        error: { message: "authentication failed" },
      }),
    finish: () => resolve({} as DesktopAppState),
    reject: () => reject(new Error("late failure")),
    error: () => {
      error = "persist failed";
    },
    queue: () => {
      queued = [{}];
    },
    listeners: () => Number(Boolean(listener)),
    submissions: () => submissions,
  };
}

test("acknowledges a new message while receiver promise stays pending", async () => {
  const f = fixture();
  const sent = f.send();
  f.append();
  f.running();
  expect(await sent).toBe("sent");
  expect(f.listeners()).toBe(0);
  // A later rejection must stay handled after the sender has been released.
  f.reject();
  await Promise.resolve();
});
test("an old identical prompt or another session cannot acknowledge this delivery", async () => {
  const f = fixture();
  const controller = new AbortController();
  const sent = f.send(controller.signal);
  f.running();
  f.append();
  f.running("other");
  controller.abort();
  await expect(sent).rejects.toThrow(/wait cancelled/);
  expect(f.listeners()).toBe(0);
});
test("already cancelled never submits", async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort();
  await expect(f.send(controller.signal)).rejects.toThrow(/before submission/);
  expect(f.submissions()).toBe(0);
  expect(f.listeners()).toBe(0);
});
test("cancellation during acknowledgement leaves receiver work alone", async () => {
  const f = fixture();
  const controller = new AbortController();
  const sent = f.send(controller.signal);
  f.append();
  f.running();
  controller.abort();
  await expect(sent).rejects.toThrow(/Its work was not stopped/);
  f.finish();
  expect(f.submissions()).toBe(1);
  expect(f.listeners()).toBe(0);
});
test("startup failure wins over running acknowledgement", async () => {
  const f = fixture();
  const sent = f.send();
  f.append();
  f.running();
  f.fail();
  await expect(sent).rejects.toThrow(/authentication failed/);
  expect(f.listeners()).toBe(0);
});
test("composer-resolved failure is not reported as sent", async () => {
  const f = fixture();
  const sent = f.send();
  f.error();
  f.finish();
  await expect(sent).rejects.toThrow(/persist failed/);
});
test("queue acknowledgement does not wait for the queued turn", async () => {
  const f = fixture();
  const sent = f.send();
  f.queue();
  f.finish();
  expect(await sent).toBe("queued");
  expect(f.listeners()).toBe(0);
});
test("timeout reports uncertain delivery without retrying", async () => {
  const f = fixture();
  await expect(f.timeout()).rejects.toThrow(/inspect the target before retrying/);
  expect(f.submissions()).toBe(1);
  expect(f.listeners()).toBe(0);
});

test("a resolved submission without evidence is not success", async () => {
  const f = fixture();
  const sent = f.send();
  f.finish();
  await expect(sent).rejects.toThrow(/without delivery evidence/);
});

test("runtime tool forwards cancellation to the delivery bridge", async () => {
  const controller = new AbortController();
  let received: AbortSignal | undefined;
  const unused = async (): Promise<never> => {
    throw new Error("Unexpected tool");
  };
  const tool = createOrchestrationRuntimeTools({
    waitForChildren: unused,
    archiveChildThreads: unused,
    createChildThread: unused,
    listThreads: unused,
    readThread: unused,
    sendMessageToThread: async (_ctx, input) => {
      received = input.signal;
      expect(input.threadId).toBe("child");
      expect(input.message).toBe("hello");
      return {
        content: [],
        details: {
          action: "pi_gui_send_message_to_thread",
          threadId: input.threadId,
          message: input.message,
          status: "sent",
        },
      };
    },
  }).find((item) => item.name === "send_message_to_thread")!;
  await tool.execute(
    "call",
    { thread_id: "child", message: "hello" },
    controller.signal,
    undefined,
    {} as Parameters<typeof tool.execute>[4],
  );
  expect(received).toBe(controller.signal);
  controller.abort();
  expect(received?.aborted).toBe(true);
});
