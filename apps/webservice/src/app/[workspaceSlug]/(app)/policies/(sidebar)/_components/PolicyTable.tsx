"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Switch } from "@ctrlplane/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { RuleType } from "./rule-themes";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import {
  getRuleTypeIcon,
  getRuleTypeLabel,
  getTypeColorClass,
} from "./rule-themes";

type Policy = RouterOutputs["policy"]["list"][number];

type PolicyTableProps = { policies: Policy[] };

const getRules = (policy: Policy) => {
  const rules: RuleType[] = [];
  if (policy.denyWindows.length > 0) rules.push("deny-window");
  if (
    policy.versionAnyApprovals != null ||
    policy.versionUserApprovals.length > 0 ||
    policy.versionRoleApprovals.length > 0
  )
    rules.push("approval-gate");

  if (policy.deploymentVersionSelector != null)
    rules.push("deployment-version-selector");

  if (policy.concurrency != null) rules.push("concurrency");
  if (policy.environmentVersionRollout != null)
    rules.push("environment-version-rollout");

  return rules;
};

type PolicyTableRowProps = { policy: Policy };

const NameCell: React.FC<{ policy: Policy }> = ({ policy }) => (
  <TableCell>
    <div className="font-medium">{policy.name}</div>
    {policy.description && (
      <div className="mt-1 line-clamp-2 max-w-md pr-4 text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
        {policy.description}
      </div>
    )}
  </TableCell>
);

const RulesCell: React.FC<{ policy: Policy }> = ({ policy }) => {
  const rules = getRules(policy);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <TableCell>
      <div className="flex flex-wrap gap-1.5">
        {rules.length === 0 ? (
          <div className="text-xs text-muted-foreground">No rules</div>
        ) : (
          rules.map((rule, idx) => {
            const Icon = getRuleTypeIcon(rule);
            const baseUrl = urls.workspace(workspaceSlug).policies();
            const url =
              rule === "approval-gate"
                ? baseUrl.approvalGates()
                : rule === "deployment-version-selector"
                  ? baseUrl.versionConditions()
                  : baseUrl.denyWindows();

            return (
              <Link href={url} key={idx}>
                <Badge
                  variant="outline"
                  className={`pl-1.5 pr-2 text-xs ${getTypeColorClass(rule)}`}
                >
                  <Icon className="size-3" />
                  <span className="ml-1">{getRuleTypeLabel(rule)}</span>
                </Badge>
              </Link>
            );
          })
        )}
      </div>
    </TableCell>
  );
};

const ReleaseTargetsCell: React.FC<{ policy: Policy; inView: boolean }> = ({
  policy,
  inView,
}) => {
  const releaseTargets = api.policy.releaseTargets.useQuery(policy.id, {
    enabled: inView,
  });
  return (
    <TableCell>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs">
            {releaseTargets.data?.count ?? "-"}
          </Badge>
        </div>
      </div>
    </TableCell>
  );
};

const PriorityCell: React.FC<{ policy: Policy }> = ({ policy }) => (
  <TableCell>
    <Badge variant="outline">{policy.priority}</Badge>
  </TableCell>
);

const StatusCell: React.FC<{
  policy: Policy;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}> = ({ policy, isEnabled, setIsEnabled }) => {
  const updatePolicy = api.policy.update.useMutation();
  return (
    <TableCell>
      <Switch
        checked={isEnabled}
        onCheckedChange={(checked) => {
          updatePolicy.mutate({
            id: policy.id,
            data: { enabled: checked },
          });
          setIsEnabled(checked);
        }}
        className="data-[state=checked]:bg-green-500"
      />
    </TableCell>
  );
};

const ActionsCell: React.FC<{ policy: Policy }> = ({ policy }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const utils = api.useUtils();
  const deletePolicy = api.policy.delete.useMutation({
    onSuccess: () => {
      utils.policy.list.invalidate();
      router.refresh();
    },
  });
  const editUrl = urls
    .workspace(workspaceSlug)
    .policies()
    .edit(policy.id)
    .baseUrl();
  return (
    <TableCell>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <IconDots className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Link href={editUrl}>
            <DropdownMenuItem className="cursor-pointer">
              <IconPencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </Link>
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => deletePolicy.mutate(policy.id)}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  );
};

const PolicyTableRow: React.FC<PolicyTableRowProps> = (props) => {
  const { ref, inView } = useInView();
  const [isEnabled, setIsEnabled] = useState(props.policy.enabled);

  return (
    <TableRow ref={ref} className="group cursor-pointer hover:bg-muted/50">
      <NameCell {...props} />
      <RulesCell {...props} />
      <ReleaseTargetsCell {...props} inView={inView} />
      <PriorityCell {...props} />
      <StatusCell
        {...props}
        isEnabled={isEnabled}
        setIsEnabled={setIsEnabled}
      />
      <ActionsCell {...props} />
    </TableRow>
  );
};

export const PolicyTable: React.FC<PolicyTableProps> = ({ policies }) => {
  // Return early if no rules to display
  if (policies.length === 0)
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No policies found</p>
      </div>
    );

  return (
    <>
      <Table>
        {/* Table Header */}
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Name</TableHead>
            <TableHead>Rules</TableHead>
            <TableHead>Targets</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>

        {/* Table Body */}
        <TableBody>
          {policies.map((policy) => (
            <PolicyTableRow key={policy.id} policy={policy} />
          ))}
        </TableBody>
      </Table>

      {/* Dialogs */}
      {/* {selectedRule && (
        <>
          <RuleDetailsDialog
            rule={selectedRule}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
          />
          <EditRuleDialog
            rule={selectedRule}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />
        </>
      )} */}
    </>
  );
};
