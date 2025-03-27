import {
  ArrowDownIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LayersIcon,
  LockClosedIcon,
} from "@radix-ui/react-icons";

import type { RuleType } from "./mock-data";

// Extended RuleType type to add the new approval-gate type
export type ExtendedRuleType = 
  RuleType | 
  'approval-gate';

export const getRuleTypeIcon = (type: ExtendedRuleType) => {
  switch (type) {
    case "time-window":
      return <ClockIcon className="size-3 text-blue-400" />;
    case "maintenance-window":
      return <ClockIcon className="size-3 text-amber-400" />;
    case "gradual-rollout":
      return <ArrowDownIcon className="size-3 text-green-400" />;
    case "rollout-ordering":
      return <LayersIcon className="size-3 text-purple-400" />;
    case "rollout-pass-rate":
      return <CheckIcon className="size-3 text-emerald-400" />;
    case "release-dependency":
      return <CalendarIcon className="size-3 text-rose-400" />;
    case "approval-gate":
      return <LockClosedIcon className="size-3 text-purple-400" />;
    default:
      return null;
  }
};

export const getRuleTypeLabel = (type: ExtendedRuleType) => {
  switch (type) {
    case "time-window":
      return "Time Window";
    case "maintenance-window":
      return "Maintenance Window";
    case "gradual-rollout":
      return "Gradual Rollout";
    case "rollout-ordering":
      return "Rollout Order";
    case "rollout-pass-rate":
      return "Success Rate Required";
    case "release-dependency":
      return "Release Dependency";
    case "approval-gate":
      return "Approval Gate";
    default:
      return type;
  }
};

// Get color class based on rule type
export const getTypeColorClass = (type: ExtendedRuleType): string => {
  switch (type) {
    case "time-window":
      return "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/50";
    case "maintenance-window":
      return "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/50";
    case "gradual-rollout":
      return "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/50";
    case "rollout-ordering":
      return "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/50";
    case "rollout-pass-rate":
      return "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/50";
    case "release-dependency":
      return "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/50";
    case "approval-gate":
      return "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/50";
    default:
      return "";
  }
};
