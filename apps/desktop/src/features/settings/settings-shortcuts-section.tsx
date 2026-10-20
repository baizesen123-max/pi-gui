import { SettingsGroup, SettingsRow } from "./settings-utils";

/**
 * "Mod" is Cmd on macOS and Ctrl elsewhere; "Ctrl" is Control on every platform.
 * "TabMod" is Control on macOS and Alt elsewhere, the side panel tab modifier.
 */
type KeyModifier = "Ctrl" | "Alt" | "Shift" | "Mod";
type Modifier = KeyModifier | "TabMod";

interface Shortcut {
  readonly title: string;
  readonly modifiers: readonly Modifier[];
  readonly key: string;
}

// Mirrors getDesktopCommandFromShortcut in contracts/ipc.ts and the keys the renderer handles
// itself (find, thread switcher, composer, terminal tabs).
const SHORTCUT_GROUPS: readonly {
  readonly title: string;
  readonly shortcuts: readonly Shortcut[];
}[] = [
  {
    title: "应用",
    shortcuts: [
      { title: "命令面板", modifiers: ["Mod"], key: "K" },
      { title: "转到文件", modifiers: ["Mod"], key: "P" },
      { title: "打开设置", modifiers: ["Mod"], key: "," },
      { title: "显示或隐藏侧边栏", modifiers: ["Mod"], key: "B" },
      { title: "显示或隐藏侧面板", modifiers: ["Mod", "Alt"], key: "B" },
      { title: "新建窗口", modifiers: ["Mod", "Shift"], key: "N" },
    ],
  },
  {
    title: "对话",
    shortcuts: [
      { title: "新建对话", modifiers: ["Mod"], key: "N" },
      { title: "切换到最近的对话", modifiers: ["Mod"], key: "1–9" },
      { title: "循环切换对话", modifiers: ["Ctrl"], key: "Tab" },
      { title: "搜索对话", modifiers: ["Mod"], key: "F" },
    ],
  },
  {
    title: "消息输入框",
    shortcuts: [
      { title: "发送消息；运行中则加入队列", modifiers: [], key: "Enter" },
      { title: "调整正在进行的任务", modifiers: ["Mod"], key: "Enter" },
      { title: "换行", modifiers: ["Shift"], key: "Enter" },
    ],
  },
  {
    title: "工作台",
    shortcuts: [
      { title: "显示或隐藏终端", modifiers: ["Mod"], key: "J" },
      { title: "新建终端标签", modifiers: ["Mod"], key: "T" },
      { title: "显示或隐藏修改审查", modifiers: ["Mod"], key: "R" },
      { title: "切换侧面板标签", modifiers: ["TabMod"], key: "1–9" },
      { title: "关闭工作台标签", modifiers: ["Mod"], key: "W" },
    ],
  },
];

// Apple's modifier order is ⌃⌥⇧⌘, matching the menu bar and the command palette hints.
const MAC_MODIFIERS: readonly (readonly [KeyModifier, string])[] = [
  ["Ctrl", "⌃"],
  ["Alt", "⌥"],
  ["Shift", "⇧"],
  ["Mod", "⌘"],
];

function shortcutKeys(platform: NodeJS.Platform, shortcut: Shortcut): readonly string[] {
  const held = shortcut.modifiers.map((modifier): KeyModifier =>
    modifier === "TabMod" ? (platform === "darwin" ? "Ctrl" : "Alt") : modifier,
  );
  if (platform === "darwin") {
    const modifiers = MAC_MODIFIERS.filter(([modifier]) => held.includes(modifier)).map(
      ([, symbol]) => symbol,
    );
    return [...modifiers, shortcut.key === "Enter" ? "↩" : shortcut.key];
  }
  const modifiers = (["Ctrl", "Alt", "Shift"] as const).filter(
    (modifier) => held.includes(modifier) || (modifier === "Ctrl" && held.includes("Mod")),
  );
  return [...modifiers, shortcut.key];
}

export function SettingsShortcutsSection({ platform }: { readonly platform: NodeJS.Platform }) {
  return (
    <>
      {SHORTCUT_GROUPS.map((group) => (
        <SettingsGroup key={group.title} title={group.title}>
          {group.shortcuts.map((shortcut) => (
            <SettingsRow key={shortcut.title} title={shortcut.title}>
              <span className="settings-keys">
                {shortcutKeys(platform, shortcut).map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </span>
            </SettingsRow>
          ))}
        </SettingsGroup>
      ))}
    </>
  );
}
