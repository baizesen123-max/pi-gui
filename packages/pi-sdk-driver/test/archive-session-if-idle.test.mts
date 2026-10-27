import test from "node:test";
import assert from "node:assert/strict";
import { sessionKey } from "@pi-gui/session-driver";
import { SessionSupervisor } from "../dist/session-supervisor.js";

function fixture() {
  const writes: unknown[] = [];
  const emitted: string[] = [];
  const record = {
    ref: { workspaceId: "ws", sessionId: "child" },
    workspace: { workspaceId: "ws", path: "/tmp/archive-probe" },
    title: "Completed child",
    updatedAt: "2026-10-24T00:00:00Z",
    status: "idle",
    archivedAt: undefined as string | undefined,
    runningRunId: undefined as string | undefined,
    promptStarting: false,
    extensionCommandsRunning: 0,
    queuedStartScheduled: false,
    queuedStartRecheck: false,
    queuedMessages: [] as unknown[],
    startingQueuedMessage: undefined as unknown,
    pendingHostUiRequests: new Map(),
    closed: false,
    listeners: new Set([
      (event: { type: string }) => {
        emitted.push(event.type);
      },
    ]),
    session: {
      isStreaming: false,
      isCompacting: false,
      pendingMessageCount: 0,
      messages: [{ role: "assistant", stopReason: "stop", content: "done" }],
    },
  };
  const supervisor = new SessionSupervisor({
    catalogStorage: {
      sessions: {
        upsertSession: async (value: unknown) => {
          writes.push(value);
        },
      },
    } as never,
  });
  (supervisor as unknown as { records: Map<string, unknown> }).records.set(
    sessionKey(record.ref),
    record,
  );
  return { supervisor, record, writes, emitted };
}

await test("idle archive preserves history and uses the normal archive/restore persistence path", async () => {
  const f = fixture();
  const history = f.record.session.messages;
  await f.supervisor.archiveSessionIfIdle(f.record.ref);
  assert.ok(f.record.archivedAt);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.emitted, ["sessionUpdated"]);
  assert.equal(f.record.session.messages, history);
  await f.supervisor.unarchiveSession(f.record.ref);
  assert.equal(f.record.archivedAt, undefined);
  assert.equal(f.record.session.messages, history);
});

const busyCases: Record<string, (record: ReturnType<typeof fixture>["record"]) => void> = {
  "running turn": (r) => {
    r.runningRunId = "run";
  },
  "prompt about to start": (r) => {
    r.promptStarting = true;
  },
  "streaming or waiting on a tool": (r) => {
    r.session.isStreaming = true;
  },
  compaction: (r) => {
    r.session.isCompacting = true;
  },
  "extension command": (r) => {
    r.extensionCommandsRunning = 1;
  },
  "queued follow-up": (r) => {
    r.queuedMessages = [{ text: "keep working" }];
  },
  "runtime queue": (r) => {
    r.session.pendingMessageCount = 1;
  },
  "scheduled queue start": (r) => {
    r.queuedStartScheduled = true;
  },
  "taken queue entry": (r) => {
    r.startingQueuedMessage = { text: "next" };
  },
  "pending dialog": (r) => {
    r.pendingHostUiRequests.set("permission", {});
  },
  "failed session": (r) => {
    r.status = "failed";
  },
};
for (const [name, mutate] of Object.entries(busyCases)) {
  await test(`idle archive refuses ${name} without a write or cancellation`, async () => {
    const f = fixture();
    mutate(f.record);
    await assert.rejects(f.supervisor.archiveSessionIfIdle(f.record.ref));
    assert.equal(f.record.archivedAt, undefined);
    assert.equal(f.writes.length, 0);
    assert.equal(f.emitted.length, 0);
  });
}
await test("idle archive checks after awaiting session loading, not an earlier idle snapshot", async () => {
  const f = fixture();
  const promise = f.supervisor.archiveSessionIfIdle(f.record.ref);
  f.record.promptStarting = true;
  await assert.rejects(promise);
  assert.equal(f.writes.length, 0);
});
await test("idle archive leaves the finished-work decision to the caller", async () => {
  const f = fixture();
  f.record.session.messages = [{ role: "assistant", stopReason: "aborted", content: "partial" }];
  await f.supervisor.archiveSessionIfIdle(f.record.ref);
  assert.ok(f.record.archivedAt);
});
