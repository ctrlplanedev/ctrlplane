"use client";

import { useState } from "react";
import {
  IconCheck,
  IconNumber1,
  IconNumber2,
  IconScan,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { GoogleTargetProviderConfig } from "./GoogleScanerConfig";
import { TargetProviderSelectCard } from "./TargetProviderSelectCard";

export default function AddTargetProviderPage() {
  const [targetProviderType, setTargetProviderType] = useState<string | null>(
    null,
  );
  return (
    <div className="container my-8 max-w-3xl space-y-4">
      <h1 className="mb-10 flex flex-grow items-center gap-3 text-2xl font-semibold">
        <IconScan />
        Add TargetProvider
      </h1>
      <div className="grid grid-cols-2 gap-2 px-4">
        <div
          onClick={() => setTargetProviderType(null)}
          className={cn(
            "flex items-center gap-4",
            targetProviderType != null &&
              "cursor-pointer text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border",
              targetProviderType == null && "border-blue-500",
            )}
          >
            {targetProviderType == null ? <IconNumber1 /> : <IconCheck />}
          </div>
          <div>Select target provider target provider</div>
        </div>

        <div
          className={cn(
            "flex items-center gap-4",
            targetProviderType == null && "text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border",
              targetProviderType != null && "border-blue-500",
            )}
          >
            <IconNumber2 />
          </div>
          <div>Configure target provider</div>
        </div>
      </div>
      {targetProviderType == null && (
        <TargetProviderSelectCard setValue={setTargetProviderType} />
      )}
      {targetProviderType === "google" && <GoogleTargetProviderConfig />}
    </div>
  );
}
