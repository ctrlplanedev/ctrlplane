"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconExternalLink, IconLoader2, IconShield } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@ctrlplane/ui/drawer";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { ApprovalAnySection } from "./AnyApprovalSection";
import { ReviewRequestedAlert } from "./ReviewRequestedAlert";
import { useEnvironmentVersionApprovalDrawer } from "./useEnvironmentVersionApprovalDrawer";
import { UserApprovalSection } from "./UserApprovalSection";

const ApprovalDrawerHeader: React.FC<{
  policies: schema.Policy[];
  environment: schema.Environment;
}> = ({ policies, environment }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const getPolicyUrl = (policyId: string) =>
    urls.workspace(workspaceSlug).policies().edit(policyId).qualitySecurity();
  return (
    <DrawerHeader className="space-y-2 border-b p-4">
      <DrawerTitle className="flex items-center gap-2 text-lg font-medium">
        <div className="flex items-center justify-center rounded-lg bg-purple-600/70 p-1">
          <IconShield className="h-6 w-6 text-purple-400" />
        </div>
        Approval status for {environment.name}
      </DrawerTitle>
      <DrawerDescription className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          {policies.map((p) => (
            <Link
              href={getPolicyUrl(p.id)}
              key={p.id}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "text-xs text-foreground",
                }),
                "flex items-center gap-1.5",
              )}
            >
              <IconExternalLink className="h-3 w-3" />
              {p.name}
            </Link>
          ))}
        </div>
      </DrawerDescription>
    </DrawerHeader>
  );
};

export const EnvironmentVersionApprovalDrawer: React.FC = () => {
  const { environmentId, versionId, removeEnvironmentVersionIds } =
    useEnvironmentVersionApprovalDrawer();
  const isOpen = environmentId != null && versionId != null;
  const setIsOpen = removeEnvironmentVersionIds;

  const { data, isLoading } = api.policy.approval.byEnvironmentVersion.useQuery(
    { environmentId: environmentId ?? "", versionId: versionId ?? "" },
    { enabled: isOpen },
  );

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-1/3 overflow-auto rounded-none rounded-l-lg focus-visible:outline-none"
      >
        {isLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {data != null && (
          <div>
            <ApprovalDrawerHeader {...data} />
            <div className="space-y-8 p-4">
              <ReviewRequestedAlert approvalState={data} />
              <ApprovalAnySection approvalState={data} />
              <UserApprovalSection approvalState={data} />
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
