# Repo Guidelines

These rules apply for the full session.

## Workflow

- Define success criteria before coding; if unclear, stop and clarify.
- For non-trivial work, plan verification before editing: name the affected user flow, observable result, failure cases, and existing commands that prove them. Start with the checked-in [desktop verification skill](.agents/skills/verify-pi-gui/SKILL.md) for desktop flows and [baseline checks](docs/ci-baseline.md) for repository checks.
- Do not create or switch to new branches to start work unless the user explicitly asks; respect the current branch or worktree as intentional.
- Commit in small focused checkpoints; don’t batch unrelated changes.
- Before closing non-trivial implementation work, review the diff for unnecessary abstractions, duplicate paths, unsafe escapes, and obsolete code; simplify within scope and rerun affected checks.

## Product

- This repo is building a Codex-style desktop app for `pi`; preserve that product direction.
- Desktop work is not done until it is verified on the real Electron surface, not only by unit tests.
- Transcript/timeline behavior, session correctness, and Codex-style UX are product features, not polish.
- Prefer clean reimplementation over patching around local complexity.

## Safety

- Never delete user session history, cached transcripts, screenshots, or temp artifacts without approval.
- Treat files you didn’t edit as read-only when multiple agents may be working.
- Ask before destructive commands or history rewrites.

## Structure

- Prefer path-scoped guidance in nested `AGENTS.md` files over growing this file.
- Follow the ownership and migration guidance in [docs/architecture.md](docs/architecture.md); target folders are not evidence that a migration is complete.
- Keep the desktop renderer/main/preload boundary tight; avoid broad Node exposure to the renderer.
- Keep `pi-sdk-driver` thin over `pi-mono`; don’t fork or reimplement `pi` runtime behavior unless necessary.

## Source Of Truth

- Root `AGENTS.md` is the repo instruction source of truth.
- Root `CLAUDE.md` should remain a symlink to `AGENTS.md`.

## 中文维护版本入口

- 项目目标：跟进上游，同时保留中文、并行流式性能修复和主子任务功能。
- 新对话启动及更新路由：先读 [长期维护流程](docs/local-maintenance.md)，再按影响面读取测试入口；现场 Git 和当前验证证据优先于旧报告。
- 安全边界：候选在独立副本验证，不得访问真实用户配置、替换安装包、重启现用 pi 或重放任务。
- 保持 `maintenance/zh-cn` 稳定，验证通过后才推进。当前授权包含候选分支与本地提交；远程推送与安装仍需对应明确授权。
