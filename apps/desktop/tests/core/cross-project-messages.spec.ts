import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import type { SessionRef } from "@pi-gui/session-driver";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  runOrchestrationRuntimeTool,
  seedAgentDir,
  selectSession,
} from "../helpers/electron-app";
import { pasteTinyPng } from "../helpers/electron-app";

// Local scripted provider only. Tool calls use the existing runtime hook because the
// product has no manual cross-thread tool button. Draft/queue interactions use the UI.
test("cross-project delivery, cancellation, loop guard and result receipts preserve the receiver", async ({}, info) => {
  const pending = new Set<ServerResponse>();
  const respond = (response: ServerResponse) => {
    pending.delete(response);
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const choice of [
      { delta: { role: "assistant", content: "合成核查结果：已完成" }, finish_reason: null },
      { delta: {}, finish_reason: "stop" },
    ])
      response.write(
        `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", model: "scripted", choices: [{ index: 0, ...choice }] })}\n\n`,
      );
    response.end("data: [DONE]\n\n");
  };
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      const payload = JSON.parse(body) as { messages: { role: string; content: unknown }[] };
      const text = JSON.stringify(
        [...payload.messages].reverse().find((m) => m.role === "user")?.content,
      );
      if (text.includes("保持原任务运行")) {
        pending.add(response);
        response.on("close", () => pending.delete(response));
      } else if (text.includes("模拟接收方失败")) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            error: { message: "Synthetic mailbox failure", type: "invalid_request_error" },
          }),
        );
      } else respond(response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const planning = await makeWorkspace("mail-planning");
  const receiver = await makeWorkspace("mail-95306");
  await seedAgentDir(agentDir, { withOpenAiAuth: false, withDefaultModel: false });
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      defaultProvider: "mail-test",
      defaultModel: "scripted",
      enabledModels: ["mail-test/scripted"],
      packages: [],
      compaction: { enabled: false },
    }),
  );
  await writeFile(
    join(agentDir, "models.json"),
    JSON.stringify({
      providers: {
        "mail-test": {
          baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
          api: "openai-completions",
          apiKey: "unused",
          models: [{ id: "scripted" }],
        },
      },
    }),
  );
  const launch = () =>
    launchDesktop(userDataDir, {
      agentDir,
      initialWorkspaces: [planning, receiver],
      scrubProviderEnv: true,
      testMode: "background",
    });
  let harness = await launch();
  const pids: number[] = [];
  pids.push(harness.electronApp.process().pid!);
  try {
    let window = await harness.firstWindow();
    const selected = async (): Promise<SessionRef> => {
      const s = await getDesktopState(window);
      return { workspaceId: s.selectedWorkspaceId!, sessionId: s.selectedSessionId! };
    };
    await createNamedThread(window, "发起项目", { workspaceName: basename(planning) });
    const source = await selected();
    await createNamedThread(window, "95306 接收会话", { workspaceName: basename(receiver) });
    const target = await selected();
    await window.getByTestId("composer").fill("保持原任务运行");
    await window.getByTestId("composer").press("Enter");
    await expect.poll(() => pending.size).toBe(1);
    await window.getByTestId("composer").fill("用户自己的排队消息");
    await window.getByTestId("composer").press("Enter");
    await expect
      .poll(async () => (await getDesktopState(window)).queuedComposerMessages.length)
      .toBe(1);
    const draft = "目标中文草稿\n不能被跨项目消息清空";
    await window.getByTestId("composer").fill(draft);
    await pasteTinyPng(window, "保留附件.png");
    await expect
      .poll(async () => (await getDesktopState(window)).composerAttachments.length)
      .toBe(1);
    await selectSession(window, "发起项目");
    const instruction = `把合成核查任务发给 ${target.sessionId} 会话，不要重启应用。`;
    await window.getByTestId("composer").fill(instruction);
    await window.getByTestId("composer").press("Enter");
    await expect(window.getByTestId("transcript")).toContainText("合成核查结果");
    const tool = (name: string, params: unknown, ref = source) =>
      runOrchestrationRuntimeTool(harness, { toolName: name, sessionRef: ref, params });
    expect(JSON.stringify((await tool("list_threads", {})).details)).not.toContain(
      target.sessionId,
    );
    expect(JSON.stringify((await tool("list_threads", { workspace: "*" })).details)).toContain(
      target.sessionId,
    );
    expect((await tool("read_thread", { thread_id: target.sessionId })).details?.workspaceId).toBe(
      target.workspaceId,
    );
    expect(
      (await tool("send_message_to_thread", { thread_id: target.sessionId, message: "缺少授权" }))
        .details?.error,
    ).toBeTruthy();
    const send = (text: string) =>
      tool("send_message_to_thread", {
        thread_id: target.sessionId,
        message: text,
        user_request: instruction,
      });
    const first = await send("待取消的消息");
    const firstId = first.details?.messageId as string;
    expect(firstId).toBeTruthy();
    expect(first.details?.receipt).toMatchObject({ status: "queued" });
    expect((await send("待取消的消息")).details?.messageId).toBe(firstId);
    expect(
      (await tool("cancel_thread_message", { message_id: firstId }, target)).details?.error,
    ).toBeTruthy();
    expect(
      (await tool("cancel_thread_message", { message_id: firstId })).details?.receipt,
    ).toMatchObject({ status: "cancelled" });
    const second = await send("需要获取结果的消息");
    const secondId = second.details?.messageId as string;
    await selectSession(window, "95306 接收会话");
    expect((await getDesktopState(window)).queuedComposerMessages.length).toBe(2);
    await expect(window.getByTestId("composer")).toHaveValue(draft);
    expect((await getDesktopState(window)).composerAttachments.length).toBe(1);
    expect(pending.size).toBe(1);
    await window.screenshot({ path: info.outputPath("queued-draft-preserved.png") });
    for (const response of [...pending]) respond(response);
    await expect
      .poll(
        async () => (await tool("get_thread_message", { message_id: secondId })).details?.receipt,
      )
      .toMatchObject({ status: "turn_finished", result: expect.stringContaining("合成核查结果") });
    expect(
      (
        await tool(
          "send_message_to_thread",
          { thread_id: source.sessionId, message: "自动回发", user_request: instruction },
          target,
        )
      ).details?.error,
    ).toContain("cannot automatically reply");
    expect(
      (await tool("cancel_thread_message", { message_id: secondId })).details?.receipt,
    ).toMatchObject({ status: "turn_finished" });
    const failure = await send("模拟接收方失败");
    const failedId = failure.details?.messageId as string;
    await expect
      .poll(
        async () => (await tool("get_thread_message", { message_id: failedId })).details?.receipt,
      )
      .toMatchObject({
        status: "failed",
        error: expect.stringContaining("Synthetic mailbox failure"),
      });
    await expect(window.getByTestId("composer")).toHaveValue(draft);
    await window.screenshot({ path: info.outputPath("result-and-failure.png") });
    const retry = await send("保持原任务运行：失败后的新请求");
    const retryId = retry.details?.messageId as string;
    await expect
      .poll(
        async () => (await tool("get_thread_message", { message_id: retryId })).details?.receipt,
      )
      .toMatchObject({ status: "running" });
    for (const response of [...pending]) respond(response);
    await expect
      .poll(
        async () => (await tool("get_thread_message", { message_id: retryId })).details?.receipt,
      )
      .toMatchObject({ status: "turn_finished" });
    expect(
      (await tool("get_thread_message", { message_id: failedId })).details?.receipt,
    ).toMatchObject({ status: "failed" });

    await harness.close();
    harness = await launch();
    pids.push(harness.electronApp.process().pid!);
    window = await harness.firstWindow();
    expect(
      (await tool("get_thread_message", { message_id: firstId })).details?.receipt,
    ).toMatchObject({ status: "cancelled" });
    expect(
      (await tool("get_thread_message", { message_id: failedId })).details?.receipt,
    ).toMatchObject({ status: "failed" });
    await selectSession(window, "95306 接收会话");
    await expect(window.getByTestId("composer")).toHaveValue(draft);
    expect((await getDesktopState(window)).composerAttachments.length).toBe(1);
    await expect(window.getByTestId("transcript")).toContainText("需要获取结果的消息");
    await window.screenshot({ path: info.outputPath("restart-history-draft.png") });
    await writeFile(
      info.outputPath("proof.json"),
      JSON.stringify({
        userDataDir,
        source,
        target,
        messageIds: [firstId, secondId, failedId],
        pids,
        realProvider: false,
        fixtureRuntime: true,
      }),
    );
  } finally {
    for (const response of pending) response.destroy();
    await harness.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await writeFile(info.outputPath("cleanup.json"), JSON.stringify({ pids, closed: true }));
  }
});
