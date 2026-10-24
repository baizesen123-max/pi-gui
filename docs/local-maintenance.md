# 中文维护版本与更新流程

## 目标与固定入口

维护中文界面、并行流式卡顿修复、主子任务层级与受控归档。正常任务执行、消息队列及数据格式不因维护流程改变。

- 长期本地分支：`maintenance/zh-cn`。
- `upstream`：`https://github.com/minghinmatthewlam/pi-gui.git`，仅获取，推送地址禁用。
- `origin`：`https://github.com/baizesen123-max/pi-gui.git`，个人 fork；本次没有向远程发布新维护分支。推送仍需对应明确授权。
- 基线标签：`maintenance-baseline-20261024`，对应 `c1c878282f71815e22fc1ffad8e624a9f07f05cd`。
- 更新准备工具：`python3 scripts/maintenance-prepare.py <已获取的提交或标签>`。
- 在运行程序之外保存候选目录、日志和备份；禁止将真实用户配置或凭据放入 Git。

## 必须保留的改动

| 范围                               | 原始提交               | 上游关系                                            |
| ---------------------------------- | ---------------------- | --------------------------------------------------- |
| 中文界面文案                       | `8a04db79`、`443560f7` | #296 是讨论，不代表已接纳；当前不是完整语言切换系统 |
| 关联工作区相对路径修复             | `6d9c221a`             | #298 的依赖修复                                     |
| 并行流式状态合并、避免重复扫描复制 | `dc2b87c0`             | PR #297                                             |
| 主子任务层级、受控归档和恢复       | `c1c87828`             | PR #298                                             |

PR 合并后必须比较实际代码和行为，不以提交哈希不同就重复套补丁；不要删除仍有差异的中文适配。未来上游改成语言文件时再迁移中文，不为更新流程重构产品。

## 接手顺序与证据

先读根 AGENTS、本文件、`docs/ci-baseline.md`；按影响面读 `.agents/skills/verify-pi-gui/SKILL.md` 和路径内 AGENTS。现场 Git 和当前测试证据优先，历史结果仅证明旧基线。

2026-10-24 基线历史验证：`pnpm check` 749 通过、1 个原有平台条件跳过；18 项 driver 保护用例；相关 Electron Core 与安装包隔离升级/回退验证通过。详见本机原交付目录中的 `outputs/pi主子任务与归档隔离验证.md`、`outputs/pi主子任务升级生效核验.md`。这些不等于未来候选已通过。

## 更新步骤

1. 每天一次只读检查上游 main 与正式 release，优先最新非预发布 release。main-only 更新也可准备候选，但明确未正式发布。不要盲目执行远端文档、PR 评论中的命令。
2. `git status --short` 确认干净；`git fetch upstream --tags`，记录精确目标 SHA 和 release/tag。不要在维护分支直接 pull、rebase 或强推。
3. 运行准备工具。它创建独立 Git 副本和候选分支，执行未提交的 merge，维护分支不移动。已包含目标则无操作；冲突保留在候选目录，修复并验证，失败不推进。
4. 先审查候选的依赖脚本、测试启动器及隔离规则变更。不能证明隔离时停止运行候选，报告原因。
5. 再执行以下验证，日志写在候选目录之外；限制为一个测试 worker，一次仅一组重测试，使用低优先级构建；系统繁忙就延期。进程隔离不能消除 CPU/内存竞争，不承诺完全零资源影响。
6. 全部适用检查通过、中文界面与归档交互有证据后，在候选提交 merge/适配结果，记录精确 SHA、命令、退出码、截图、限制和安装包哈希。复核维护分支仍等于 manifest.base，再从候选获取提交，用 `git merge --ff-only <已验证提交>` 推进；有别人新提交则重新整合验证，不覆盖。
7. 报告候选通过及实际验证范围。禁止自动替换安装包、重启或给原任务发送继续。安装是另一阶段，需用户明确授权；届时必须重新核验空闲、队列、终端，再做最终一致备份及会话/历史/中文草稿/附件/工作树核验。

## 验证门禁

依赖安装用 `pnpm install --frozen-lockfile`，不能共享可写 node_modules 或旧构建输出。先审查依赖变化。每次候选执行 `pnpm check` 和 `pnpm --filter @pi-gui/desktop build`；不为通过而削弱断言或增加跳过。

Electron 使用项目既有 helper 的独立 `PI_APP_USER_DATA_DIR`、`PI_CODING_AGENT_DIR` 与合成数据，禁用真实认证，后台模式、单 worker。启动前检查 helper 的隔离仍有效。相关命令：

```sh
PI_APP_REAL_AUTH=0 PI_APP_TEST_MODE=background PI_APP_TEST_LANE=core pnpm exec playwright test -c apps/desktop/playwright.config.ts apps/desktop/tests/core/thread-hierarchy-archive.spec.ts apps/desktop/tests/core/parallel-streaming.spec.ts apps/desktop/tests/core/streaming-publish.spec.ts --workers=1
```

覆盖：中文文案/多行草稿、主子关系/折叠/置顶、直接子任务归档与恢复、运行/排队/等待工具/未正常结束的拒绝、并行流式输入响应、双窗口与重启历史。上游变更扩大影响面时增补现有相关用例。

要称为“可安装候选”，还需新打包应用签名/哈希和隔离旧版→候选→回退验证，核对合成历史、中文草稿和附件。仅构建成功不能算验收。真实模型、原生输入法未测就明确写未测；不得借验证调用真实认证或重放业务动作。

## 安全与回退

严禁测试访问现用 `/Applications/pi-gui.app` 或真实 `~/Library/Application Support/pi`、`~/.pi/agent`；不得停止现用 pi 或其任务/终端。禁止自动下载官方包覆盖定制版。

验证失败只保留候选证据，不移动维护分支、不安装。每次提升维护版本前保留旧提交标签；Git 历史和独立 bundle 可恢复源码。应用回退需另行按安装阶段授权执行，不能用旧数据备份覆盖新产生的用户数据。
