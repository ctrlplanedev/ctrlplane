/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DeploymentVersion } from "./DeploymentVersion";

type EnvironmentVersionDecisionsProps = {
  environment: { id: string; name: string };
  deploymentId: string;
  versions: { id: string; name?: string; tag?: string }[];
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
              <div className="space-y-2 rounded-lg border p-2" key={version.id}>
                <h3 className="text-sm font-semibold">
                  {version.name || version.tag}
                </h3>
                <div className="flex flex-col gap-1">
                  <DeploymentVersion
                    version={version}
                    environment={environment}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
