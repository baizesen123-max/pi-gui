import type { RuntimeSkillRecord } from "@pi-gui/session-driver/runtime-types";
import type { WorkspaceRecord } from "../../../contracts/desktop-state";
import { titleCase } from "../../lib/string-utils";
import { SkillIcon } from "../../ui/icons";
import { SettingsGroup, SettingsRow } from "../settings/settings-utils";
import { sourceScopeGroupLabel } from "./extension-display";
import { displayPath, ResourceDetail } from "./resource-detail";
import { ResourceEmptyState, ResourceList, type ResourceListGroup } from "./resource-list";

const GROUP_ORDER = ["工作区", "用户", "当前会话"];

interface SkillsTabProps {
  readonly workspace: WorkspaceRecord;
  readonly skills: readonly RuntimeSkillRecord[];
  readonly searching: boolean;
  /** The skill whose detail page is open, looked up in the unfiltered list. */
  readonly selected?: RuntimeSkillRecord;
  readonly onSelect: (filePath: string | undefined) => void;
  readonly onToggleSkill: (filePath: string, enabled: boolean) => void;
  readonly onOpenSkillFolder: (filePath: string) => void;
  readonly onTrySkill: (skill: RuntimeSkillRecord) => void;
}

export function SkillsTab({
  workspace,
  skills,
  searching,
  selected,
  onSelect,
  onToggleSkill,
  onOpenSkillFolder,
  onTrySkill,
}: SkillsTabProps) {
  // The list stays mounted under an open detail so expanded groups, scroll and focus survive.
  const list =
    skills.length === 0 ? (
      <ResourceEmptyState
        title={searching ? "没有匹配的技能" : "暂无技能"}
        body={
          searching
            ? "请尝试其他名称、描述或斜杠命令。"
            : "从工作区和用户技能目录中查找技能。可新建技能，或添加后刷新。"
        }
      />
    ) : (
      <ResourceList
        expanded={searching}
        groups={groupSkills(skills, onToggleSkill)}
        icon={<SkillIcon />}
        testId="skills-list"
        onOpen={onSelect}
      />
    );

  return (
    <>
      {selected ? (
        <ResourceDetail
          actions={
            <>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => onOpenSkillFolder(selected.filePath)}
              >
                打开文件夹
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={() => onTrySkill(selected)}
              >
                试用
              </button>
            </>
          }
          backLabel="全部技能"
          enabled={selected.enabled}
          icon={<SkillIcon />}
          subtitle={selected.slashCommand}
          title={titleCase(selected.name)}
          onBack={() => onSelect(undefined)}
          onToggle={(enabled) => onToggleSkill(selected.filePath, enabled)}
        >
          <p className="resource-detail__description">{selected.description}</p>
          <SettingsGroup>
            <SettingsRow title="斜杠命令" description="在输入框中输入此命令，即可运行技能。">
              <code className="resource-detail__code">{selected.slashCommand}</code>
            </SettingsRow>
            <SettingsRow
              title="模型调用"
              description={
                selected.disableModelInvocation
                  ? "仅在手动输入斜杠命令时运行。"
                  : "任务适合时，pi 也可以自动选择此技能。"
              }
            >
              <span className="settings-row__value">
                {selected.disableModelInvocation ? "仅通过斜杠命令调用" : "自动"}
              </span>
            </SettingsRow>
            <SettingsRow title="位置" description={sourceScopeGroupLabel(selected.scope)}>
              <code className="resource-detail__code" title={selected.filePath}>
                {displayPath(selected.filePath, workspace.path)}
              </code>
            </SettingsRow>
          </SettingsGroup>
        </ResourceDetail>
      ) : null}
      <div hidden={Boolean(selected)}>{list}</div>
    </>
  );
}

function groupSkills(
  skills: readonly RuntimeSkillRecord[],
  onToggleSkill: (filePath: string, enabled: boolean) => void,
): readonly ResourceListGroup[] {
  return GROUP_ORDER.map((label) => ({
    label,
    items: skills
      .filter((skill) => sourceScopeGroupLabel(skill.scope) === label)
      .map((skill) => ({
        id: skill.filePath,
        title: titleCase(skill.name),
        description: skill.description,
        enabled: skill.enabled,
        onToggle: (enabled: boolean) => onToggleSkill(skill.filePath, enabled),
      })),
  })).filter((group) => group.items.length > 0);
}
