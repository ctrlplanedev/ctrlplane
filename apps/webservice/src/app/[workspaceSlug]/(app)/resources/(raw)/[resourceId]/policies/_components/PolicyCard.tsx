import type { RouterOutputs } from "@ctrlplane/api";
import Link from "next/link";
import {
  IconAdjustments,
  IconArrowUpRight,
  IconClock,
  IconHelpCircle,
  IconShield,
  IconShieldCheck,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { urls } from "~/app/urls";

type Policy = RouterOutputs["policy"]["byResourceId"][number];

type PolicySummaryCardConfig = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  tooltip: string;
  badgeConfig: {
    activeText: string;
    inactiveText: string;
    activeColor: string;
  };
  countLabel: string;
  dataSelector: (policies: Policy[]) => {
    isActive: boolean;
    count: number;
  };
};

type PolicySummaryCardProps = {
  config: PolicySummaryCardConfig;
  workspaceSlug: string;
};

const PolicySummaryCard: React.FC<
  PolicySummaryCardProps & { data: { isActive: boolean; count: number } }
> = ({ config, workspaceSlug, data }) => {
  const { isActive, count } = data;
  const Icon = config.icon;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border bg-neutral-900/50">
      <div className="border-b p-4 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
            {config.title}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[350px]">
                  <p>{config.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-neutral-400">
            {config.countLabel}
          </div>
          <div className="text-right font-medium">
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={
                isActive
                  ? `${config.badgeConfig.activeColor} text-white`
                  : "text-muted-foreground"
              }
            >
              {isActive
                ? config.badgeConfig.activeText
                : config.badgeConfig.inactiveText}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            Policies Count
          </div>
          <div className="text-right font-medium text-neutral-100">{count}</div>
        </div>
      </div>
      <div className="mt-auto border-t bg-neutral-900/60 p-2 text-right">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
          asChild
        >
          <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
            View Policies <IconArrowUpRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

type PolicyCardProps = {
  policies: RouterOutputs["policy"]["byResourceId"];
  workspaceSlug: string;
  cardConfigs: PolicySummaryCardConfig[];
};

export const PolicyCard: React.FC<PolicyCardProps> = ({
  policies,
  workspaceSlug,
  cardConfigs,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
      {cardConfigs.map((config) => (
        <PolicySummaryCard
          key={config.id}
          config={config}
          workspaceSlug={workspaceSlug}
          data={config.dataSelector(policies)}
        />
      ))}
    </div>
  );
};

export const policyCardConfigs: PolicySummaryCardConfig[] = [
  {
    id: "approval",
    title: "Approval & Governance",
    icon: IconShieldCheck,
    iconColor: "text-blue-400",
    tooltip:
      "Shows policies that require manual approvals or have governance rules for deployments to this resource.",
    badgeConfig: {
      activeText: "Yes",
      inactiveText: "No",
      activeColor: "bg-blue-500",
    },
    countLabel: "Approval Required",
    dataSelector: (policies: Policy[]) => {
      const approvalPolicies = policies.filter(
        (p) =>
          p.versionAnyApprovals != null ||
          p.versionUserApprovals.length > 0 ||
          p.versionRoleApprovals.length > 0,
      );
      return {
        isActive: approvalPolicies.length > 0,
        count: approvalPolicies.length,
      };
    },
  },
  {
    id: "deny-windows",
    title: "Deny Windows",
    icon: IconClock,
    iconColor: "text-red-400",
    tooltip:
      "Time-based restrictions that prevent deployments during specific periods, like maintenance windows or business hours.",
    badgeConfig: {
      activeText: "Active",
      inactiveText: "None",
      activeColor: "bg-red-500",
    },
    countLabel: "Time Restrictions",
    dataSelector: (policies: Policy[]) => {
      const denyWindowPolicies = policies.filter(
        (p) => p.denyWindows.length > 0,
      );
      return {
        isActive: denyWindowPolicies.length > 0,
        count: denyWindowPolicies.length,
      };
    },
  },
  {
    id: "version-conditions",
    title: "Version Conditions",
    icon: IconShield,
    iconColor: "text-purple-400",
    tooltip:
      "Rules that control which deployment versions are allowed based on version criteria, tags, or other metadata.",
    badgeConfig: {
      activeText: "Active",
      inactiveText: "None",
      activeColor: "bg-purple-500",
    },
    countLabel: "Version Rules",
    dataSelector: (policies: Policy[]) => {
      const versionConditionPolicies = policies.filter(
        (p) => p.deploymentVersionSelector != null,
      );
      return {
        isActive: versionConditionPolicies.length > 0,
        count: versionConditionPolicies.length,
      };
    },
  },
  {
    id: "concurrency",
    title: "Concurrency Control",
    icon: IconAdjustments,
    iconColor: "text-yellow-400",
    tooltip:
      "Limits on how many deployments can run simultaneously for this resource, helping to control system load and deployment conflicts.",
    badgeConfig: {
      activeText: "Yes",
      inactiveText: "Unlimited",
      activeColor: "bg-yellow-500",
    },
    countLabel: "Limits Configured",
    dataSelector: (policies: Policy[]) => {
      const concurrencyPolicies = policies.filter((p) => p.concurrency != null);
      return {
        isActive: concurrencyPolicies.length > 0,
        count: concurrencyPolicies.length,
      };
    },
  },
];
