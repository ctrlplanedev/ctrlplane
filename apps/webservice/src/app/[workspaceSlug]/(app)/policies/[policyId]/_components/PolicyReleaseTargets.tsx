"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconArrowRight,
  IconBox,
  IconFolder,
  IconPackage,
  IconServer,
  IconTerminal,
} from "@tabler/icons-react";
import _ from "lodash";

import { Badge } from "@ctrlplane/ui/badge";
import { ScrollArea } from "@ctrlplane/ui/scroll-area";
import { Separator } from "@ctrlplane/ui/separator";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

export const PolicyReleaseTargets: React.FC<{
  policy: { id: string };
}> = ({ policy }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data, isLoading } = api.policy.releaseTargets.useQuery(policy.id, {
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  const releaseTargets = data?.releaseTargets ?? [];

  if (releaseTargets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <IconFolder className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No release targets found
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.count} release {data?.count === 1 ? "target" : "targets"}
        </p>
      </div>

      <ScrollArea className="h-[300px] pr-4">
        {_(releaseTargets)
          .groupBy((r) => r.system.id)
          .map((rts, systemId) => (
            <div key={systemId} className="mb-4">
              <Link
                href={urls
                  .workspace(workspaceSlug)
                  .system(rts[0]!.system.slug)
                  .baseUrl()}
                className="hover:underline"
              >
                <div className="mt-4 flex items-center gap-1.5 text-sm font-medium">
                  <IconBox className="h-4 w-4 text-muted-foreground" />
                  <span>{rts[0]!.system.name}</span>
                  <Badge variant="outline" className="ml-2">
                    System
                  </Badge>
                </div>
              </Link>
              <Separator className="my-2" />
              <div className="ml-4 flex flex-col gap-3">
                {rts.map((rt) => (
                  <div
                    key={rt.id}
                    className="flex flex-col rounded-md border border-border p-2 text-sm"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <IconTerminal className="h-4 w-4 text-blue-500" />
                      <Link
                        href={urls
                          .workspace(workspaceSlug)
                          .system(rt.system.slug)
                          .deployment(rt.deployment.slug)
                          .baseUrl()}
                        className="hover:underline"
                      >
                        {rt.deployment.name}
                      </Link>
                    </div>

                    <div className="mt-2 flex items-center gap-6 pl-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <IconServer className="h-3.5 w-3.5" />
                        <span>{rt.environment.name}</span>
                      </div>

                      <IconArrowRight className="h-3 w-3" />

                      <div className="flex items-center gap-1">
                        <IconPackage className="h-3.5 w-3.5" />
                        <Link
                          href={urls
                            .workspace(workspaceSlug)
                            .resource(rt.resource.id)
                            .baseUrl()}
                          className="hover:underline"
                        >
                          {rt.resource.name}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
          .value()}
      </ScrollArea>
    </div>
  );
};
