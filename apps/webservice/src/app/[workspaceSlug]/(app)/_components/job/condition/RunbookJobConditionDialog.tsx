import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { MAX_DEPTH_ALLOWED } from "@ctrlplane/validators/conditions";
import {
  defaultCondition,
  isEmptyCondition,
  isValidJobCondition,
} from "@ctrlplane/validators/jobs";

import { RunbookJobConditionRender } from "./RunbookJobConditionRender";

type RunbookJobConditionDialogProps = {
  condition: JobCondition | null;
  onChange: (condition: JobCondition | null) => void;
  children: React.ReactNode;
};

export const RunbookJobConditionDialog: React.FC<
  RunbookJobConditionDialogProps
> = ({ condition, onChange, children }) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCondition, setLocalCondition] = useState(
    condition ?? defaultCondition,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Job Condition</DialogTitle>
          <DialogDescription>
            Edit the job filter, up to a depth of {MAX_DEPTH_ALLOWED + 1}.
          </DialogDescription>
        </DialogHeader>
        <RunbookJobConditionRender
          condition={localCondition}
          onChange={setLocalCondition}
        />
        {error && <span className="text-sm text-red-600">{error}</span>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setLocalCondition(defaultCondition);
              setError(null);
            }}
          >
            Clear
          </Button>
          <div className="flex-grow" />
          <Button
            onClick={() => {
              if (!isValidJobCondition(localCondition)) {
                setError(
                  "Invalid job condition, ensure all fields are filled out correctly.",
                );
                return;
              }
              setOpen(false);
              setError(null);
              if (isEmptyCondition(localCondition)) {
                onChange(null);
                return;
              }
              onChange(localCondition);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
