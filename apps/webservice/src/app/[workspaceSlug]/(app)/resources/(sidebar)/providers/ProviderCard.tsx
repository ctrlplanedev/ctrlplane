"use client";

import React from "react";
import Link from "next/link";
import { SiAmazon, SiGooglecloud } from "@icons-pack/react-simple-icons";
import {
  IconBrandAzure,
  IconExternalLink,
  IconSettings,
} from "@tabler/icons-react";

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

// Get status icon/color based on sync status
const getSyncStatusDetails = (status: string) => {
  switch (status) {
    case "success":
      return {
        color: "text-green-400",
        bgColor: "bg-green-400",
        statusText: "Healthy",
      };
    case "warning":
      return {
        color: "text-yellow-400",
        bgColor: "bg-yellow-400",
        statusText: "Warning",
      };
    case "error":
      return {
        color: "text-red-400",
        bgColor: "bg-red-400",
        statusText: "Error",
      };
    default:
      return {
        color: "text-neutral-400",
        bgColor: "bg-neutral-400",
        statusText: "Unknown",
      };
  }
};

interface ProviderCardProps {
  id: string;
  name: string;
  type: "aws" | "google" | "azure" | "custom";
  typeName: string;
  resourceCount: number;
  resourceKinds: Array<{ version: string; kind: string }>;
  syncStatus: string;
  lastSyncTime: string;
  filterLink: string;
  className?: string;
}

export function ProviderCard({
  name,
  type,
  typeName,
  resourceCount,
  resourceKinds,
  syncStatus,
  lastSyncTime,
  filterLink,
  className,
  compact = false,
}: ProviderCardProps & { compact?: boolean }) {
  // Use a more compact card layout if compact is true
  if (compact) {
    return (
      <Card
        className={cn(
          "flex h-[120px] flex-col border-neutral-800/50 bg-gradient-to-br from-neutral-900/90 to-neutral-900/80 shadow-sm transition-all hover:border-neutral-700/50 hover:shadow-md",
          className,
        )}
      >
        <div className="flex h-full flex-col p-3">
          <div className="mb-1 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800/50">
                {type === "aws" ? (
                  <SiAmazon className="h-3 w-3 text-orange-400" />
                ) : type === "google" ? (
                  <SiGooglecloud className="h-3 w-3 text-red-400" />
                ) : type === "azure" ? (
                  <IconBrandAzure className="h-3 w-3 text-blue-400" />
                ) : (
                  <IconSettings className="h-3 w-3 text-blue-300" />
                )}
              </div>
              <div>
                <h3 className="line-clamp-1 text-sm font-medium text-neutral-200">
                  {name}
                </h3>
                <p className="line-clamp-1 text-xs text-neutral-500">
                  {typeName.split(" ")[0]}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1">
            <div
              className={`h-2 w-2 rounded-full ${getSyncStatusDetails(syncStatus).bgColor}`}
            />
            <span className="text-xs text-neutral-400">{lastSyncTime}</span>
          </div>

          <div className="mt-auto flex">
            <div className="flex flex-1 items-center gap-1">
              <span className="text-sm font-medium text-blue-400">
                {resourceCount}
              </span>
              <span className="text-xs text-neutral-500">resources</span>
            </div>

            <Link
              href={filterLink}
              className={cn(
                buttonVariants({ variant: "outline", size: "xs" }),
                "border-blue-500/30 bg-blue-500/10 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300",
              )}
            >
              View
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  // Standard card layout
  return (
    <Card
      className={cn(
        "flex h-full flex-col border-neutral-800/50 bg-gradient-to-br from-neutral-900/90 to-neutral-900/80 shadow-sm transition-all hover:border-neutral-700/50 hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="line-clamp-1 text-base font-medium">
            {name}
          </CardTitle>
          <p className="line-clamp-1 text-xs text-neutral-400">
            {typeName} • {resourceKinds.length} resource kinds
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
              {resourceCount}
            </span>
            <span className="text-xs text-neutral-500">Resources</span>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-neutral-800/60 bg-neutral-800/20 px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <div
                className={`h-2 w-2 rounded-full ${getSyncStatusDetails(syncStatus).bgColor}`}
              ></div>
              <span
                className={`text-sm font-medium ${getSyncStatusDetails(syncStatus).color}`}
              >
                {getSyncStatusDetails(syncStatus).statusText}
              </span>
            </div>
            <span className="text-xs text-neutral-500">{lastSyncTime}</span>
          </div>
        </div>

        {resourceKinds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resourceKinds.slice(0, 2).map((kind) => (
              <Badge
                key={kind.kind}
                variant="outline"
                className="h-5 gap-1 rounded-full border border-neutral-700/50 bg-neutral-800/30 px-2 text-xs font-medium text-neutral-300 shadow-sm"
              >
                {kind.kind}
              </Badge>
            ))}
            {resourceKinds.length > 2 && (
              <Badge
                variant="outline"
                className="h-5 gap-1 rounded-full border border-neutral-700/50 bg-neutral-800/30 px-2 text-xs font-medium text-blue-400 shadow-sm"
              >
                +{resourceKinds.length - 2} more
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
}
