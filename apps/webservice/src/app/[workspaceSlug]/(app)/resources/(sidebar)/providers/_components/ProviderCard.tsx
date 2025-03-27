"use client";

import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SiAmazon, SiGooglecloud } from "@icons-pack/react-simple-icons";
import {
  IconBrandAzure,
  IconExternalLink,
  IconSettings,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import LZString from "lz-string";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { urls } from "~/app/urls";
import { ProviderActionsDropdown } from "./ProviderActionsDropdown";

interface ProviderCardProps {
  id: string;
  name: string;
  type: "aws" | "google" | "azure" | "custom";
  totalResources: number;
  kinds: Array<string>;
  lastSyncedAt: Date | null;
}

const getFilterHash = (id: string) => {
  const selector: ResourceCondition = {
    type: ResourceFilterType.Provider,
    value: id,
    operator: ColumnOperator.Equals,
  };
  const json = JSON.stringify(selector);
  return LZString.compressToEncodedURIComponent(json);
};

export const ProviderCard: React.FC<ProviderCardProps> = ({
  id,
  name,
  type,
  totalResources,
  kinds,
  lastSyncedAt,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const filterHash = getFilterHash(id);
  const resourcesUrl = urls.workspace(workspaceSlug).resources().list();
  const filterLink = `${resourcesUrl}?filter=${filterHash}`;
  const lastSyncedAgo = lastSyncedAt
    ? `Last sync ${formatDistanceToNowStrict(lastSyncedAt, {
        addSuffix: true,
      })}`
    : "has not synced";
  return (
    <Card className="flex h-[236px] flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="line-clamp-1 flex items-center gap-2 text-base font-medium">
            {name}
            <ProviderActionsDropdown providerId={id} />
          </CardTitle>
          <p className="line-clamp-1 text-xs text-neutral-400">
            {type} • {kinds.length} resource kind{kinds.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800/50">
          {type === "aws" ? (
            <SiAmazon className="h-4 w-4 text-orange-400" />
          ) : type === "google" ? (
            <SiGooglecloud className="h-4 w-4 text-red-400" />
          ) : type === "azure" ? (
            <IconBrandAzure className="h-4 w-4 text-blue-400" />
          ) : (
            <IconSettings className="h-4 w-4 text-blue-300" />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col justify-center rounded-md border border-neutral-800/60 bg-neutral-800/20 px-3 py-2 text-center">
            <span className="text-lg font-medium text-blue-400">
              {totalResources}
            </span>
            <span className="text-xs text-neutral-500">Resources</span>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-neutral-800/60 bg-neutral-800/20 px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-green-400">
                Healthy
              </span>
            </div>
            <span className="text-xs text-neutral-500">{lastSyncedAgo}</span>
          </div>
        </div>

        {kinds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {kinds.slice(0, 2).map((kind) => (
              <Badge
                key={kind}
                variant="outline"
                className="h-5 gap-1 rounded-full border border-neutral-700/50 bg-neutral-800/30 px-2 text-xs font-medium text-neutral-300 shadow-sm"
              >
                {kind}
              </Badge>
            ))}
            {kinds.length > 2 && (
              <Badge
                variant="outline"
                className="h-5 gap-1 rounded-full border border-neutral-700/50 bg-neutral-800/30 px-2 text-xs font-medium text-blue-400 shadow-sm"
              >
                +{kinds.length - 2} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Link
          href={filterLink}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full justify-between gap-1.5 border-blue-500/30 bg-blue-500/10 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300",
          )}
        >
          View Resources
          <IconExternalLink className="h-3.5 w-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
};
