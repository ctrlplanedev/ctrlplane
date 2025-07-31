"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IconCalendarClock, IconLoader2 } from "@tabler/icons-react";

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
import { ChartsSection } from "./ChartsSection";
import { useRolloutDrawer } from "./useRolloutDrawer";

const PolicyLink: React.FC<{ policy: { id: string; name: string } }> = ({
  policy,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const policyUrl = urls
    .workspace(workspaceSlug)
    .policies()
    .edit(policy.id)
    .rollouts();

  return (
    <Link
      href={policyUrl}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "text-xs text-foreground",
      )}
    >
      {policy.name}
    </Link>
  );
};

const RolloutDrawerHeader: React.FC<{
  policy: { id: string; name: string };
  environment: { name: string };
}> = ({ policy, environment }) => {
  return (
    <DrawerHeader className="space-y-2 border-b p-4">
      <DrawerTitle className="flex items-center gap-2 text-lg font-medium">
        <div className="flex items-center justify-center rounded-lg bg-purple-600/70 p-1">
          <IconCalendarClock className="h-6 w-6 text-purple-400" />
        </div>
        Rollout status for {environment.name}
      </DrawerTitle>
      <DrawerDescription className="flex items-center gap-2">
        <PolicyLink policy={policy} />
      </DrawerDescription>
    </DrawerHeader>
  );
};

export const RolloutDrawer: React.FC = () => {
  const { environmentId, versionId, removeEnvironmentVersionIds } =
    useRolloutDrawer();
  const setIsOpen = removeEnvironmentVersionIds;

  const isOpen = environmentId != null && versionId != null;

  const { data, isLoading } = api.policy.rollout.list.useQuery(
    { environmentId: environmentId ?? "", versionId: versionId ?? "" },
    { enabled: isOpen },
  );

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-1/2 overflow-auto rounded-none rounded-l-lg focus-visible:outline-none"
      >
        {isLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {data != null && (
          <div>
            <RolloutDrawerHeader
              policy={data.rolloutPolicy}
              environment={data.environment}
            />
            <ChartsSection
              deploymentId={data.version.deploymentId}
              environmentId={environmentId ?? ""}
              versionId={versionId ?? ""}
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
