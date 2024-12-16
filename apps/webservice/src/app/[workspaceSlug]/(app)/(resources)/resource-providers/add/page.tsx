"use client";

import { useState } from "react";
import {
  IconCheck,
  IconNumber1,
  IconNumber2,
  IconScan,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { GoogleResourceProviderConfig } from "./GoogleScanerConfig";
import { ResourceProviderSelectCard } from "./ResourceProviderSelectCard";

export default function AddResourceProviderPage() {
  const [resourceProviderType, setResourceProviderType] = useState<
    string | null
  >(null);
  return (
    <div className="container my-8 max-w-3xl space-y-4">
      <h1 className="mb-10 flex flex-grow items-center gap-3 text-2xl font-semibold">
        <IconScan className="h-4 w-4" />
        Add resource provider
      </h1>
      <div className="grid grid-cols-2 gap-2 px-4">
        <div
          onClick={() => setResourceProviderType(null)}
          className={cn(
            "flex items-center gap-4",
            resourceProviderType != null &&
              "cursor-pointer text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border",
              resourceProviderType == null && "border-blue-500",
            )}
          >
            {resourceProviderType == null ? (
              <IconNumber1 className="h-4 w-4" />
            ) : (
              <IconCheck className="h-4 w-4" />
            )}
          </div>
          <div>Select resource provider</div>
        </div>

        <div
          className={cn(
            "flex items-center gap-4",
            resourceProviderType == null && "text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border",
              resourceProviderType != null && "border-blue-500",
            )}
          >
            <IconNumber2 />
          </div>
          <div>Configure resource provider</div>
        </div>
      </div>
      {resourceProviderType == null && (
        <ResourceProviderSelectCard setValue={setResourceProviderType} />
      )}
      {resourceProviderType === "google" && <GoogleResourceProviderConfig />}
    </div>
  );
}
