/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { ShieldOffIcon } from "lucide-react";

import type { DeploymentVersionStatus } from "../types";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DeploymentVersion } from "./DeploymentVersion";
import { PolicySkipDialog } from "./policy-skip/PolicySkipDialog";
import { usePolicyRulesForVersion } from "./usePolicyRulesForVersion";

type VersionRowProps = {
  version: {
    id: string;
    name?: string;
    tag?: string;
    status: DeploymentVersionStatus;
  };
  environment: { id: string; name: string };
};

function VersionRow({ version, environment }: VersionRowProps) {
  const { policyRules } = usePolicyRulesForVersion(
    version.id,
    environment.id,
  );

  return (
    <div className="space-y-2 rounded-lg border p-2" key={version.id}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {version.name || version.tag}
        </h3>
        {policyRules.length > 0 && (
          <PolicySkipDialog
            environmentId={environment.id}
            versionId={version.id}
            rules={policyRules}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1.5 rounded-full px-2.5 text-xs"
            >
              <ShieldOffIcon className="size-3" />
              Skip Policy
            </Button>
          </PolicySkipDialog>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <DeploymentVersion version={version} environment={environment} />
      </div>
    </div>
  );
}

type EnvironmentVersionDecisionsProps = {
  environment: { id: string; name: string };
  deploymentId: string;
  versions: {
    id: string;
    name?: string;
    tag?: string;
    status: DeploymentVersionStatus;
  }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EnvironmentVersionDecisions({
  environment,
  versions,
  open,
  onOpenChange,
}: EnvironmentVersionDecisionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">{environment.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {versions.map((version) => (
              <VersionRow
                key={version.id}
                version={version}
                environment={environment}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
