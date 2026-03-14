// Skills utility types and functions for the Skills Discovery UI.
// Types match the gateway `skills.status` response shape.

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string; // "openclaw-bundled" | "openclaw-managed" | "openclaw-workspace" | "openclaw-extra"
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    anyBins?: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    anyBins?: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: Array<{ path: string; satisfied: boolean }>;
  install: Array<{ id: string; kind: string; label: string; bins: string[] }>;
};

export type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};

export type SkillGroup = {
  id: string;
  label: string;
  skills: SkillStatusEntry[];
};

/**
 * Groups skills by source into ordered categories.
 * Order: Workspace, Built-in, Installed, Extra, Other.
 * Bundled flag takes priority for Built-in grouping.
 * Empty groups are filtered out.
 */
export function groupSkills(skills: SkillStatusEntry[]): SkillGroup[] {
  const groups: Record<string, SkillStatusEntry[]> = {
    workspace: [],
    bundled: [],
    managed: [],
    extra: [],
    other: [],
  };

  for (const skill of skills) {
    // Check bundled flag first -- some bundled skills may have a different source
    if (skill.bundled) {
      groups.bundled.push(skill);
    } else if (skill.source === "openclaw-workspace") {
      groups.workspace.push(skill);
    } else if (skill.source === "openclaw-bundled") {
      groups.bundled.push(skill);
    } else if (skill.source === "openclaw-managed") {
      groups.managed.push(skill);
    } else if (skill.source === "openclaw-extra") {
      groups.extra.push(skill);
    } else {
      groups.other.push(skill);
    }
  }

  const orderedGroups: SkillGroup[] = [
    { id: "workspace", label: "Workspace Skills", skills: groups.workspace },
    { id: "bundled", label: "Built-in Skills", skills: groups.bundled },
    { id: "managed", label: "Installed Skills", skills: groups.managed },
    { id: "extra", label: "Extra Skills", skills: groups.extra },
    { id: "other", label: "Other Skills", skills: groups.other },
  ];

  return orderedGroups.filter((g) => g.skills.length > 0);
}

/**
 * Returns the display status for a skill.
 * Priority: disabled > unavailable (not eligible) > enabled.
 */
export function getSkillDisplayStatus(
  skill: SkillStatusEntry,
): "enabled" | "disabled" | "unavailable" {
  if (skill.disabled) return "disabled";
  if (!skill.eligible) return "unavailable";
  return "enabled";
}

/**
 * Returns a human-readable list of missing items for a skill.
 * Each item is prefixed with its category (bin, env, config, os).
 */
/**
 * Returns true if the skill requires an API key (has a primaryEnv field).
 */
export function skillNeedsApiKey(skill: SkillStatusEntry): boolean {
  return Boolean(skill.primaryEnv);
}

/**
 * Returns true if the skill's required API key is already set (not missing).
 */
export function hasApiKeySet(skill: SkillStatusEntry): boolean {
  return Boolean(
    skill.primaryEnv && !skill.missing.env.includes(skill.primaryEnv),
  );
}

/**
 * Returns true when the toggle should be disabled.
 * A user-disabled skill always allows toggling (to re-enable).
 * An unavailable skill that is NOT user-disabled cannot be toggled.
 */
export function isToggleDisabled(skill: SkillStatusEntry): boolean {
  return !skill.disabled && !skill.eligible;
}

/**
 * Returns true if the skill has install options and is missing required binaries.
 * Used to decide whether to show an install button on the compact card.
 */
export function canInstallSkill(skill: SkillStatusEntry): boolean {
  return skill.install.length > 0 && skill.missing.bins.length > 0;
}

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
  const items: string[] = [];

  for (const bin of skill.missing.bins) {
    items.push(`bin: ${bin}`);
  }

  if (skill.missing.anyBins) {
    for (const bin of skill.missing.anyBins) {
      items.push(`bin: ${bin} (any)`);
    }
  }

  for (const env of skill.missing.env) {
    items.push(`env: ${env}`);
  }

  for (const config of skill.missing.config) {
    items.push(`config: ${config}`);
  }

  for (const os of skill.missing.os) {
    items.push(`os: ${os}`);
  }

  return items;
}
