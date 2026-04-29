import { evaluate } from "cel-js";
import { Check, GitBranch, X } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

type CurrentVersion = {
  id: string;
  tag: string;
  name: string;
  status: string;
  environmentId: string;
  completedAt: string | null;
};

type Dependency = {
  dependencyDeploymentId: string;
  dependencyDeploymentName: string | null;
  versionSelector: string;
  currentVersion: CurrentVersion | null;
};

type EvaluatedDependency = Dependency & { satisfied: boolean };

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
        },
      }),
    );
  } catch {
    return false;
  }
}

function evaluateDependencies(dependencies: Dependency[]) {
  const evaluated: EvaluatedDependency[] = dependencies.map((dep) => ({
    ...dep,
    satisfied: evalSelector(dep.versionSelector, dep.currentVersion),
  }));
  const satisfiedCount = evaluated.filter((d) => d.satisfied).length;
  return { evaluated, satisfiedCount, total: dependencies.length };
}

function StatusIcon({ satisfied }: { satisfied: boolean }) {
  if (satisfied) return <Check className="size-4 shrink-0 text-green-500" />;
  return <X className="size-4 shrink-0 text-red-500" />;
}

type DependenciesHeaderProps = {
  versionLabel: string;
  satisfiedCount: number;
  total: number;
};

function DependenciesHeader({
  versionLabel,
  satisfiedCount,
  total,
}: DependenciesHeaderProps) {
  const allSatisfied = satisfiedCount === total;
  return (
    <CardHeader className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="size-4 text-muted-foreground" />
          Dependencies
        </div>
        <Badge variant={allSatisfied ? "default" : "destructive"}>
          {satisfiedCount} / {total} satisfied
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Declared by{" "}
        <span className="font-mono text-foreground">{versionLabel}</span>
      </p>
    </CardHeader>
  );
}

type DependencyNameProps = {
  workspaceSlug: string;
  deploymentId: string;
  name: string | null;
};

function DependencyName({
  workspaceSlug,
  deploymentId,
  name,
}: DependencyNameProps) {
  return (
    <Link
      to={`/${workspaceSlug}/deployments/${deploymentId}`}
      className="text-sm font-medium hover:underline"
    >
      {name ?? deploymentId}
    </Link>
  );
}

function DependencySelector({ selector }: { selector: string }) {
  return (
    <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
      {selector}
    </code>
  );
}

function DependencyCurrent({
  currentVersion,
}: {
  currentVersion: CurrentVersion | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Current:</span>
      {currentVersion == null ? (
        <span className="italic text-muted-foreground">
          not deployed on this resource
        </span>
      ) : (
        <span className="font-mono text-foreground">
          {currentVersion.name || currentVersion.tag}
        </span>
      )}
    </div>
  );
}

type DependencyRowProps = {
  workspaceSlug: string;
  dependency: EvaluatedDependency;
};

function DependencyRow({ workspaceSlug, dependency }: DependencyRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="mt-0.5">
        <StatusIcon satisfied={dependency.satisfied} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <DependencyName
          workspaceSlug={workspaceSlug}
          deploymentId={dependency.dependencyDeploymentId}
          name={dependency.dependencyDeploymentName}
        />
        <DependencySelector selector={dependency.versionSelector} />
        <DependencyCurrent currentVersion={dependency.currentVersion} />
      </div>
    </div>
  );
}

function DependenciesLoading() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="size-4 text-muted-foreground" />
          Dependencies
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

type DependenciesProps = {
  workspaceSlug: string;
  deploymentId: string;
  environmentId: string;
  resourceId: string;
};

export function Dependencies({
  workspaceSlug,
  deploymentId,
  environmentId,
  resourceId,
}: DependenciesProps) {
  const { data, isLoading } = trpc.releaseTargets.dependencies.useQuery(
    { deploymentId, environmentId, resourceId },
    { refetchInterval: 15_000 },
  );

  if (isLoading) return <DependenciesLoading />;
  if (data?.version == null) return null;
  if (data.dependencies.length === 0) return null;

  const { evaluated, satisfiedCount, total } = evaluateDependencies(
    data.dependencies,
  );

  return (
    <Card>
      <DependenciesHeader
        versionLabel={data.version.name || data.version.tag}
        satisfiedCount={satisfiedCount}
        total={total}
      />
      <CardContent>
        <div className="divide-y">
          {evaluated.map((dep) => (
            <DependencyRow
              key={dep.dependencyDeploymentId}
              workspaceSlug={workspaceSlug}
              dependency={dep}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
