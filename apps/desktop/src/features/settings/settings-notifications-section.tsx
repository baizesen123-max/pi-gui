import type { DesktopNotificationPermissionStatus } from "../../../contracts/ipc";
import type { NotificationPreferences } from "../../../contracts/desktop-state";
import { SettingsSwitch } from "./settings-controls";
import { SettingsGroup, SettingsRow } from "./settings-utils";

interface SettingsNotificationsSectionProps {
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
}

export function SettingsNotificationsSection({
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  onSetNotificationPreferences,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
}: SettingsNotificationsSectionProps) {
  const statusLabel = labelForPermissionStatus(notificationPermissionStatus);
  const statusDescription = descriptionForPermissionStatus(notificationPermissionStatus);
  const showAskMacOs = notificationPermissionStatus === "default";
  const showOpenSystemSettings = notificationPermissionStatus === "denied";
  const showRecoveryActions = showAskMacOs || showOpenSystemSettings;

  return (
    <>
      <SettingsGroup
        title="跟随系统"
        description="macOS decides whether pi-gui can show desktop notifications at all."
      >
        <SettingsRow title="macOS 通知权限" description={statusDescription}>
          <span className="settings-row__value">{statusLabel}</span>
        </SettingsRow>
        {showRecoveryActions ? (
          <SettingsRow
            title="开启通知"
            description={
              showAskMacOs
                ? "任务首次转到后台时，pi-gui 会向 macOS 请求通知权限，也可以现在请求。"
                : "macOS 已关闭 pi-gui 的通知，请在系统设置中重新开启。"
            }
          >
            <div className="settings-row__actions">
              {showAskMacOs ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onRequestNotificationPermission}
                >
                  请求通知权限
                </button>
              ) : null}
              {showOpenSystemSettings ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onOpenSystemNotificationSettings}
                >
                  打开系统设置
                </button>
              ) : null}
            </div>
          </SettingsRow>
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title="应用内提醒"
        description="获得 macOS 通知权限后，选择哪些后台事件需要通知。"
      >
        <SettingsRow title="后台任务完成" description="后台会话完成时通知。">
          <SettingsSwitch
            checked={notificationPreferences.backgroundCompletion}
            label="后台任务完成"
            onChange={(checked) => onSetNotificationPreferences({ backgroundCompletion: checked })}
          />
        </SettingsRow>
        <SettingsRow title="后台任务失败" description="后台会话失败时通知。">
          <SettingsSwitch
            checked={notificationPreferences.backgroundFailure}
            label="后台任务失败"
            onChange={(checked) => onSetNotificationPreferences({ backgroundFailure: checked })}
          />
        </SettingsRow>
        <SettingsRow title="需要输入或确认" description="需要你的输入才能继续时通知。">
          <SettingsSwitch
            checked={notificationPreferences.attentionNeeded}
            label="需要输入或确认"
            onChange={(checked) => onSetNotificationPreferences({ attentionNeeded: checked })}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function labelForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "已启用";
    case "denied":
      return "已关闭";
    case "default":
      return "尚未启用";
    case "unsupported":
      return "不可用";
    default:
      return "正在检查…";
  }
}

function descriptionForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "macOS will allow pi-gui to show desktop notifications for background thread updates.";
    case "denied":
      return "macOS 已关闭 pi-gui 的通知。请在系统设置中开启，以接收后台任务完成提醒。";
    case "default":
      return "pi-gui has not asked macOS for desktop notification access yet.";
    case "unsupported":
      return "此系统不支持桌面通知。";
    default:
      return "正在检查 pi-gui 是否可使用 macOS 通知。";
  }
}
