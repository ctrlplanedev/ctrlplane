"use client";

import type { Runbook, RunbookVariable } from "@ctrlplane/db/schema";
import type {
  ChoiceVariableConfigType,
  StringVariableConfigType,
} from "@ctrlplane/validators/variables";
import type { ReactNode } from "react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Switch } from "@ctrlplane/ui/switch";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

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

const VariableChoiceSelect: React.FC<
  ChoiceVariableConfigType & {
    value: string;
    onSelect: (v: string) => void;
  }
> = ({ value, onSelect, options }) => {
  return (
    <Select value={value} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const [open, setOpen] = useState(false);
  const trigger = api.runbook.trigger.useMutation();
  const [variables, setVariables] = useState<Record<string, any>>({});
  const router = useRouter();

  const handleTriggerRunbook = async () => {
    await trigger.mutateAsync({ runbookId: runbook.id, variables });
    router.refresh();
    setOpen(false);
  };

  const getValue = (k: string) => variables[k];
  const onChange = (k: string) => (v: string) =>
    setVariables((a) => ({ ...a, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Runbook: {runbook.name}</DialogTitle>
          <DialogDescription>
            Fill in the parameters below to trigger the runbook.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {runbook.variables.map((v) =>
            v.config?.type !== "boolean" ? (
              <div key={v.id} className="space-y-2">
                <Label>{v.name}</Label>
                {v.config?.type === "string" && (
                  <VariableStringInput
                    {...v.config}
                    value={getValue(v.key) ?? ""}
                    onChange={onChange(v.key)}
                  />
                )}

                {v.config?.type === "number" && (
                  <Input
                    type="number"
                    value={getValue(v.key) ?? ""}
                    onChange={(e) => onChange(v.key)(e.target.value)}
                  />
                )}

                {v.config?.type === "choice" && (
                  <VariableChoiceSelect
                    {...v.config}
                    value={getValue(v.key) ?? ""}
                    onSelect={onChange(v.key)}
                  />
                )}

                {v.description !== "" && (
                  <div className="text-xs text-muted-foreground">
                    {v.description}
                  </div>
                )}
              </div>
            ) : (
              <div key={v.id} className="flex items-center gap-4">
                <Label>{v.name}</Label>
                <Switch
                  checked={getValue(v.key) === "true"}
                  onCheckedChange={(checked) =>
                    onChange(v.key)(checked.toString())
                  }
                />
              </div>
            ),
          )}
        </div>
        <pre>{JSON.stringify(variables, null, 2)}</pre>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button onClick={handleTriggerRunbook}>Trigger</Button>
        </DialogFooter>
        <DialogClose />
      </DialogContent>
    </Dialog>
  );
};
