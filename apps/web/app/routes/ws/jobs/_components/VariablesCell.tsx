import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Copy } from "lucide-react";
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { TableCell } from "~/components/ui/table";

type JobWithRelease = WorkspaceEngine["schemas"]["JobWithRelease"];
type VariablesCellProps = { jobWithRelease: JobWithRelease };

function VariablesDialog({ jobWithRelease }: VariablesCellProps) {
  const { variables } = jobWithRelease.release;
  const isEmpty = Object.keys(variables).length === 0;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="cursor-pointer hover:underline">
          {Object.keys(variables).length} variables
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Variables</DialogTitle>
        </DialogHeader>

        {isEmpty && (
          <p className="text-sm text-muted-foreground">No variables</p>
        )}
        {!isEmpty && (
          <div className="flex flex-col gap-2">
            {Object.keys(variables).map((key) => (
              <div key={key} className="flex min-w-0 gap-2 truncate">
                <span className="font-medium">{key}</span>
                {typeof variables[key] === "object" ? (
                  <pre>{JSON.stringify(variables[key], null, 2)}</pre>
                ) : (
                  <span>{variables[key]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function VariablesCell({ jobWithRelease }: VariablesCellProps) {
  return (
    <TableCell>
      <VariablesDialog jobWithRelease={jobWithRelease} />
    </TableCell>
  );
}
