import { useState } from "react";
import { Clock, Rocket, Search } from "lucide-react";
import { Link, useParams } from "react-router";

import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  getVersionStatusColor,
  getVersionStatusIcon,
} from "./_components/helpers";
import { mockDeploymentDetail } from "./_components/mockData";

export function meta() {
  return [
    { title: "Versions - Deployment Details - Ctrlplane" },
    { name: "description", content: "View all deployment versions" },
  ];
}

export default function DeploymentVersions() {
  const _deploymentId = useParams().deploymentId;

  // In a real app, fetch deployment data based on deploymentId
  const deployment = mockDeploymentDetail;
  // Calculate stats for each version
  const versionsWithStats = deployment.versions.map((version) => {
    const currentReleaseTargets = deployment.releaseTargets.filter(
      (rt) => rt.version.currentId === version.id,
    );
    const desiredReleaseTargets = deployment.releaseTargets.filter(
      (rt) => rt.version.desiredId === version.id,
    );
    const blockedReleaseTargets = deployment.releaseTargets.filter((rt) =>
      rt.version.blockedVersions?.some((bv) => bv.versionId === version.id),
    );

    const currentEnvironments = new Set(
      currentReleaseTargets.map((rt) => rt.environment.name),
    );
    const desiredEnvironments = new Set(
      desiredReleaseTargets.map((rt) => rt.environment.name),
    );

    return {
      ...version,
      currentCount: currentReleaseTargets.length,
      desiredCount: desiredReleaseTargets.length,
      blockedCount: blockedReleaseTargets.length,
      currentEnvironments: Array.from(currentEnvironments),
      desiredEnvironments: Array.from(desiredEnvironments),
    };
  });

  const [searchQuery, setSearchQuery] = useState("");
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbItem>
                  <Link to={`/deployments`}>Deployments</Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <Link to={`/deployments/${deployment.id}`}>
                    {deployment.name}
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbPage>Versions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex min-w-[350px] items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Desired</TableHead>
            <TableHead>Blocked</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versionsWithStats.map((version) => (
            <TableRow key={version.id}>
              {/* Version Tag */}
              <TableCell className="font-mono font-semibold">
                {version.tag}
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge className={getVersionStatusColor(version.status)}>
                  {getVersionStatusIcon(version.status)}
                  <span className="ml-1 capitalize">{version.status}</span>
                </Badge>
              </TableCell>

              {/* Message */}
              <TableCell className="max-w-md">
                <span className="line-clamp-1 text-sm text-muted-foreground">
                  {version.message ?? "-"}
                </span>
              </TableCell>

              {/* Current Deployments */}
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{version.currentCount}</div>
                  {version.currentEnvironments.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {version.currentEnvironments.map((env) => (
                        <Badge
                          key={env}
                          variant="outline"
                          className="px-1 py-0 text-xs"
                        >
                          {env}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TableCell>

              {/* Desired Deployments */}
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium text-blue-600">
                    {version.desiredCount}
                  </div>
                  {version.desiredEnvironments.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {version.desiredEnvironments.map((env) => (
                        <Badge
                          key={env}
                          variant="outline"
                          className="border-blue-500/30 bg-blue-500/5 px-1 py-0 text-xs text-blue-600"
                        >
                          {env}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TableCell>

              {/* Blocked */}
              <TableCell>
                {version.blockedCount > 0 && (
                  <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600">
                    {version.blockedCount}
                  </Badge>
                )}
              </TableCell>

              {/* Created */}
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {version.createdAt}
                </div>
              </TableCell>

              {/* Actions */}
              <TableCell>
                <div className="flex gap-2">
                  <Link
                    to={`/deployments/${deployment.id}?version=${version.id}`}
                  >
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                  {version.desiredCount < deployment.releaseTargets.length && (
                    <Button size="sm" variant="outline">
                      <Rocket className="mr-1 h-4 w-4" />
                      Deploy
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
