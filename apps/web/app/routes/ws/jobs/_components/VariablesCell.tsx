import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { TableCell } from "~/components/ui/table";

type VariablesCellProps = { job: WorkspaceEngine["schemas"]["Job"] };

function VariablesDialog({ job }: VariablesCellProps) {
  const variables = job.dispatchContext?.variables ?? {};
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
            {Object.entries(variables).map(([key, value]) => (
              <div key={key} className="flex min-w-0 gap-2 truncate">
                <span className="font-medium">{key}</span>
                {typeof value === "object" ? (
                  <pre>{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  <span>{String(value)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function VariablesCell({ job }: VariablesCellProps) {
  return (
    <TableCell>
      <VariablesDialog job={job} />
    </TableCell>
  );
}
