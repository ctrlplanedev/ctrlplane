import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { CreateSkipForm } from "./CreateSkipForm";
import { CurrentSkips } from "./CurrentSkips";

export function PolicySkipDialog({
  children,
  ...props
}: {
  environmentId: string;
  versionId: string;
  rules: WorkspaceEngine["schemas"]["PolicyRule"][];
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Policy Skips</DialogTitle>
          <DialogDescription>
            Policy skips allow you to skip policy rules for a specific version
            and environment.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4">
          <CurrentSkips {...props} />
        </div>

        <Separator />

        <div className="px-4 pb-4">
          <CreateSkipForm {...props} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
