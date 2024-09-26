import type { TargetCondition } from "@ctrlplane/validators/targets";
import React, { useState } from "react";

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
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { TargetConditionRender } from "./TargetConditionRender";

type TargetConditionDialogProps = {
  condition?: TargetCondition;
  onChange: (condition: TargetCondition) => void;
  children: React.ReactNode;
};

const defaultCondition: TargetCondition = {
  type: TargetFilterType.Comparison,
  operator: TargetOperator.And,
  conditions: [],
};

export const TargetConditionDialog: React.FC<TargetConditionDialogProps> = ({
  condition,
  onChange,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [localCondition, setLocalCondition] = useState(
    condition ?? defaultCondition,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="min-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Edit Target Filter</DialogTitle>
          <DialogDescription>
            Edit the target filter for this environment.
          </DialogDescription>
        </DialogHeader>
        <TargetConditionRender
          condition={localCondition}
          onChange={setLocalCondition}
        />
        <DialogFooter>
          <Button
            onClick={() => {
              onChange(localCondition);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
