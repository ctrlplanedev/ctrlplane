"use client";

import type { Runbook, RunbookVariable } from "@ctrlplane/db/schema";
import type { StringVariableConfigType } from "@ctrlplane/validators/variables";
import type { ReactNode } from "react";
import React, { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Textarea } from "@ctrlplane/ui/textarea";

const VariableStringInput: React.FC<
  StringVariableConfigType & {
    value: string;
    onChange: (v: string) => void;
  }
> = ({
  value,
  onChange,
  inputType,
  minLength,
  maxLength,
  default: defaultValue,
}) => {
  return (
    <div>
      {inputType === "text" && (
        <Input
          type="text"
          value={value}
          placeholder={defaultValue}
          onChange={(e) => onChange(e.target.value)}
          minLength={minLength}
          maxLength={maxLength}
        />
      )}
      {inputType === "text-area" && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={minLength}
          maxLength={maxLength}
        />
      )}
    </div>
  );
};

export type TriggerRunbookDialogProps = {
  runbook: Runbook & { variables: RunbookVariable[] };
  children: ReactNode;
};

export const TriggerRunbookDialog: React.FC<TriggerRunbookDialogProps> = ({
  runbook,
  children,
}) => {
  const handleTriggerRunbook = () => {
    // Logic to trigger the provided runbook
  };

  const [values, setValues] = useState<Record<string, any>>({});

  const getValue = (k: string) => values[k];
  const onChange = (k: string) => (v: string) =>
    setValues((a) => ({ ...a, [k]: v }));

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Runbook: {runbook.name}</DialogTitle>
          <DialogDescription>
            Fill in the parameters below to trigger the runbook.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {runbook.variables.map((v) => (
            <div key={v.id} className="space-y-2">
              <Label>{v.name}</Label>
              {v.config?.type === "string" && (
                <VariableStringInput
                  {...v.config}
                  value={getValue(v.key) ?? ""}
                  onChange={onChange(v.key)}
                />
              )}

              {v.description !== "" && (
                <div className="text-xs text-muted-foreground">
                  {v.description}
                </div>
              )}
            </div>
          ))}
        </div>
        <pre>{JSON.stringify(values, null, 2)}</pre>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button onClick={handleTriggerRunbook}>Trigger</Button>
        </DialogFooter>
        <DialogClose />
      </DialogContent>
    </Dialog>
  );
};
