import {
  ArrowDownIcon,
  CalendarIcon,
  CheckIcon,
  LayersIcon,
} from "@radix-ui/react-icons";
import {
  IconCalendarTime,
  IconFilter,
  IconUserCheck,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

export type RuleType =
  | "deny-window"
  | "gradual-rollout"
  | "rollout-ordering"
  | "rollout-pass-rate"
  | "release-dependency"
  | "approval-gate"
  | "deployment-version-selector";

export const ruleTypeIcons: Record<
  RuleType,
  React.FC<{ className?: string }>
> = {
  "deny-window": (props) => (
    <IconCalendarTime className={cn("size-3 text-blue-400", props.className)} />
  ),
  "gradual-rollout": (props) => (
    <ArrowDownIcon className={cn("size-3 text-green-400", props.className)} />
  ),
  "rollout-ordering": (props) => (
    <LayersIcon className={cn("size-3 text-purple-400", props.className)} />
  ),
  "rollout-pass-rate": (props) => (
    <CheckIcon className={cn("size-3 text-emerald-400", props.className)} />
  ),
  "release-dependency": (props) => (
    <CalendarIcon className={cn("size-3 text-rose-400", props.className)} />
  ),
  "approval-gate": (props) => (
    <IconUserCheck className={cn("size-3 text-purple-400", props.className)} />
  ),
  "deployment-version-selector": (props) => (
    <IconFilter className={cn("size-3 text-purple-400", props.className)} />
  ),
} as const;

export const getRuleTypeIcon = (type: RuleType) => {
  return ruleTypeIcons[type];
};

export const ruleTypeLabels: Record<RuleType, string> = {
  "deny-window": "Deny Window",
  "gradual-rollout": "Gradual Rollout",
  "rollout-ordering": "Rollout Order",
  "rollout-pass-rate": "Success Rate Required",
  "release-dependency": "Release Dependency",
  "approval-gate": "Approval Gate",
  "deployment-version-selector": "Deployment Version Selector",
} as const;

export const getRuleTypeLabel = (type: RuleType) => {
  return ruleTypeLabels[type];
};

export const ruleTypeColors: Record<RuleType, string> = {
  "deny-window":
    "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/50",
  "gradual-rollout":
    "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/50",
  "rollout-ordering":
    "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/50",
  "rollout-pass-rate":
    "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/50",
  "release-dependency":
    "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/50",
  "approval-gate":
    "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/50",
  "deployment-version-selector":
    "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/50",
} as const;

export const getTypeColorClass = (type: RuleType): string => {
  return ruleTypeColors[type];
};
