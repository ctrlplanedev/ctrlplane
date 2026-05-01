import { useState } from "react";
import { evaluate } from "cel-js";
import {
  CheckCircle2Icon,
  ChevronDown,
  ChevronRight,
  CircleAlertIcon,
} from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";

type CurrentVersion = {
  id: string;
  tag: string;
  name: string;
  status: string;
  deploymentId: string;
  createdAt: string;
  message: string | null;
  metadata: Record<string, string>;
};

type Target = {
  resourceId: string;
  resourceName: string;
  environmentId: string;
  environmentName: string;
  currentVersion: CurrentVersion | null;
};

type Dependency = {
  dependencyDeploymentId: string;
  dependencyDeploymentName: string | null;
  versionSelector: string;
  targets: Target[];
};

type EvaluatedTarget = Target & { satisfied: boolean };
type EvaluatedDependency = Omit<Dependency, "targets"> & {
  targets: EvaluatedTarget[];
  satisfiedCount: number;
  total: number;
  allSatisfied: boolean;
};

function evalSelector(selector: string, version: CurrentVersion | null) {
  if (version == null) return false;
  try {
    return Boolean(
      evaluate(selector, {
        version: {
          id: version.id,
          tag: version.tag,
          name: version.name,
          status: version.status,
          deploymentId: version.deploymentId,
          createdAt: version.createdAt,
          message: version.message ?? "",
          metadata: version.metadata ?? {},
        },
      }),
    );
  } catch {
    return false;
  }
}

function evaluateForEnvironment(
  dependencies: Dependency[],
  environmentId: string,
): EvaluatedDependency[] {
  return dependencies.map((dep) => {
    const targets: EvaluatedTarget[] = dep.targets
      .filter((t) => t.environmentId === environmentId)
      .map((t) => ({
        ...t,
        satisfied: evalSelector(dep.versionSelector, t.currentVersion),
      }));
    const satisfiedCount = targets.filter((t) => t.satisfied).length;
    return {
      ...dep,
      targets,
      satisfiedCount,
      total: targets.length,
      allSatisfied: satisfiedCount === targets.length,
    };
  });
}

function summarizeBlockedTargets(deps: EvaluatedDependency[]) {
  const blockedKeys = new Set<string>();
  let totalKeys = new Set<string>();
  for (const dep of deps) {
    for (const t of dep.targets) {
      const key = t.resourceId;
      totalKeys.add(key);
      if (!t.satisfied) blockedKeys.add(key);
    }
  }
  return { blocked: blockedKeys.size, total: totalKeys.size };
}

type SummaryRowProps = {
  blocked: number;
  total: number;
};

function SummaryRow({ blocked, total }: SummaryRowProps) {
  const allSatisfied = blocked === 0;
  return (
    <DialogTrigger className="flex w-full items-center gap-2 rounded-sm p-1 text-left hover:bg-accent">
      {allSatisfied ? (
        <CheckCircle2Icon className="size-3 text-green-500" />
      ) : (
        <CircleAlertIcon className="size-3 text-amber-500" />
      )}
      <span className="grow">
        Dependencies
        {total > 0 && ` (${total - blocked}/${total} targets satisfied)`}
      </span>
    </DialogTrigger>
  );
}

type StatusIconProps = { satisfied: boolean };

function StatusIcon({ satisfied }: StatusIconProps) {
  if (satisfied)
    return <CheckCircle2Icon className="size-3.5 text-green-500" />;
  return <CircleAlertIcon className="size-3.5 text-amber-500" />;
}

type DependencyTargetRowProps = {
  target: EvaluatedTarget;
};

function DependencyTargetRow({ target }: DependencyTargetRowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <StatusIcon satisfied={target.satisfied} />
      <span className="grow truncate">{target.resourceName}</span>
      <span className="font-mono text-muted-foreground">
        {target.currentVersion == null
          ? "—"
          : target.currentVersion.name || target.currentVersion.tag}
      </span>
    </div>
  );
}

type DependencyGroupHeaderProps = {
  dependency: EvaluatedDependency;
  workspaceSlug: string;
  open: boolean;
  onToggle: () => void;
};

function DependencyGroupHeader({
  dependency,
  workspaceSlug,
  open,
  onToggle,
}: DependencyGroupHeaderProps) {
  const Caret = open ? ChevronDown : ChevronRight;
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-accent">
      <button
        type="button"
        onClick={onToggle}
        className="flex shrink-0 items-center gap-2"
        aria-expanded={open}
        aria-label={open ? "Collapse" : "Expand"}
      >
        <Caret className="size-3.5 text-muted-foreground" />
        <StatusIcon satisfied={dependency.allSatisfied} />
      </button>
      <Link
        to={`/${workspaceSlug}/deployments/${dependency.dependencyDeploymentId}`}
        target="_blank"
        className="text-sm font-medium hover:underline"
      >
        {dependency.dependencyDeploymentName ??
          dependency.dependencyDeploymentId}
      </Link>
      <span className="grow" />
      <span
        className={cn(
          "text-xs",
          dependency.allSatisfied ? "text-muted-foreground" : "text-amber-500",
        )}
      >
        {dependency.satisfiedCount} / {dependency.total} satisfied
      </span>
    </div>
  );
}

function SelectorRow({ selector }: { selector: string }) {
  return (
    <div className="bg-muted/50 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">selector:</span>{" "}
      <code className="font-mono">{selector}</code>
    </div>
  );
}

function EmptyTargets() {
  return (
    <div className="px-3 py-2 text-xs italic text-muted-foreground">
      No release targets in this environment.
    </div>
  );
}

type DependencyTargetListProps = {
  targets: EvaluatedTarget[];
};

function DependencyTargetList({ targets }: DependencyTargetListProps) {
  if (targets.length === 0) return <EmptyTargets />;
  return (
    <div className="divide-y">
      {targets.map((t) => (
        <DependencyTargetRow key={t.resourceId} target={t} />
      ))}
    </div>
  );
}

type DependencyGroupBodyProps = {
  dependency: EvaluatedDependency;
};

function DependencyGroupBody({ dependency }: DependencyGroupBodyProps) {
  return (
    <div className="border-t">
      <SelectorRow selector={dependency.versionSelector} />
      <DependencyTargetList targets={dependency.targets} />
    </div>
  );
}

type DependencyGroupProps = {
  dependency: EvaluatedDependency;
  workspaceSlug: string;
  defaultOpen: boolean;
};

function DependencyGroup({
  dependency,
  workspaceSlug,
  defaultOpen,
}: DependencyGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border">
      <DependencyGroupHeader
        dependency={dependency}
        workspaceSlug={workspaceSlug}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && <DependencyGroupBody dependency={dependency} />}
    </div>
  );
}

type DependencyDialogContentProps = {
  versionLabel: string;
  environmentName: string;
  blocked: number;
  total: number;
  evaluated: EvaluatedDependency[];
  workspaceSlug: string;
};

function DependencyDialogContent({
  versionLabel,
  environmentName,
  blocked,
  total,
  evaluated,
  workspaceSlug,
}: DependencyDialogContentProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Dependencies — {versionLabel}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {versionLabel} declares {evaluated.length}{" "}
          {evaluated.length === 1 ? "dependency" : "dependencies"}.{" "}
          {blocked === 0
            ? `All ${total} release target${total === 1 ? "" : "s"} in ${environmentName} are satisfied.`
            : `${blocked} of ${total} release target${total === 1 ? "" : "s"} in ${environmentName} blocked.`}
        </p>
        <div className="max-h-96 space-y-2 overflow-auto">
          {evaluated.map((dep) => (
            <DependencyGroup
              key={dep.dependencyDeploymentId}
              dependency={dep}
              workspaceSlug={workspaceSlug}
              defaultOpen={!dep.allSatisfied}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export type DependencyDetailProps = {
  versionId: string;
  environment: { id: string; name: string };
};

export function DependencyDetail({
  versionId,
  environment,
}: DependencyDetailProps) {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.deploymentVersions.dependencies.useQuery(
    { versionId },
    { refetchInterval: 15_000 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3 animate-spin" />
        Loading dependencies…
      </div>
    );
  }

  if (data == null) return null;
  if (data.dependencies.length === 0) return null;

  const evaluated = evaluateForEnvironment(data.dependencies, environment.id);
  const summary = summarizeBlockedTargets(evaluated);
  const versionLabel = data.version.name || data.version.tag;

  return (
    <Dialog>
      <SummaryRow blocked={summary.blocked} total={summary.total} />
      <DialogContent className="max-w-2xl">
        <DependencyDialogContent
          versionLabel={versionLabel}
          environmentName={environment.name}
          blocked={summary.blocked}
          total={summary.total}
          evaluated={evaluated}
          workspaceSlug={workspace.slug}
        />
      </DialogContent>
    </Dialog>
  );
}
