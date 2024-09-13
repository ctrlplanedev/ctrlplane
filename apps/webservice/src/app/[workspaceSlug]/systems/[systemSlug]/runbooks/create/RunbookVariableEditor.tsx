"use client";

import type { InsertRunbookVariable } from "@ctrlplane/db/schema";
import React, { forwardRef, useState } from "react";
import _ from "lodash";
import { TbX } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@ctrlplane/ui/accordion";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import {
  BooleanConfigFields,
  ChoiceConfigFields,
  ConfigTypeSelector,
  StringConfigFields,
} from "./ConfigFields";

type RunbookVariableEditorProps = {
  value: InsertRunbookVariable;
  onChange: (value: InsertRunbookVariable) => void;
};

export const RunbookVariableEditor = forwardRef<
  HTMLDivElement,
  RunbookVariableEditorProps
>(({ value, onChange }, ref) => {
  const { config } = value;
  const update = (update: Partial<InsertRunbookVariable>) =>
    onChange(_.merge(value, update));

  const updateConfig = (config: Partial<InsertRunbookVariable["config"]>) =>
    update({ config: _.merge(value.config, config) });

  const setConfig = (config: InsertRunbookVariable["config"]) => {
    onChange({ ...value, config });
  };
  return (
    <div className="space-y-4" ref={ref}>
      <div className="space-y-1">
        <Label>Key</Label>
        <Input
          value={value.key}
          onChange={(e) => update({ key: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Name</Label>
        <Input
          type="text"
          placeholder="Name"
          value={value.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label>Input Display</Label>
        <ConfigTypeSelector
          value={value.config?.type}
          onChange={(type: any) =>
            onChange({
              ...value,
              config: type === "choice" ? { type, options: [] } : { type },
            })
          }
        />
      </div>

      {config?.type === "string" && (
        <StringConfigFields
          config={config}
          updateConfig={updateConfig}
          setConfig={setConfig}
        />
      )}
      {config?.type === "boolean" && (
        <BooleanConfigFields
          config={config}
          updateConfig={updateConfig}
          setConfig={setConfig}
        />
      )}
      {config?.type === "choice" && (
        <ChoiceConfigFields
          config={config}
          updateConfig={updateConfig}
          setConfig={setConfig}
        />
      )}

      <pre>{JSON.stringify(config, null, 2)}</pre>
    </div>
  );
});

export const RunbookVariablesEditor: React.FC<{
  value: InsertRunbookVariable[];
  onChange: (v: InsertRunbookVariable[]) => void;
}> = ({ value, onChange }) => {
  const [openVar, setOpenVar] = useState("");
  const addVariable = () => {
    const newVariable: InsertRunbookVariable = {
      key: "",
      name: "",
      description: "",
      config: { type: "string", inputType: "text" },
    };
    onChange([...value, newVariable]);
    setOpenVar(String(value.length));
  };

  const removeVariable = (index: number) => {
    const newVariables = [...value];
    newVariables.splice(index, 1);
    onChange(newVariables);
  };

  const updateVariable = (
    index: number,
    updatedVariable: InsertRunbookVariable,
  ) => {
    const newVariables = [...value];
    newVariables[index] = updatedVariable;
    onChange(newVariables);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          disabled={value.some((v) => v.key === "")}
          onClick={addVariable}
        >
          Add Variable
        </Button>
      </div>
      {value.length !== 0 && (
        <Card className="mb-2">
          <Accordion
            type="single"
            collapsible
            value={openVar}
            onValueChange={setOpenVar}
          >
            {value.map((variable, idx) => (
              <AccordionItem
                key={idx}
                value={String(idx)}
                className={cn(idx === value.length - 1 && "border-b-0")}
              >
                <AccordionTrigger
                  className={cn(
                    "px-6",
                    variable.key === "" &&
                      "italic text-muted-foreground hover:underline",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="text-sm">
                      {variable.key === "" ? (
                        <span>Key is not set</span>
                      ) : (
                        <code className="text-xs">{variable.key}</code>
                      )}
                    </div>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVariable(idx);
                            }}
                            className="mr-4 h-5 w-5 text-red-400 hover:text-red-700"
                          >
                            <TbX className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="not-italic text-white">
                          Remove variable
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                  <RunbookVariableEditor
                    value={variable}
                    onChange={(v) => updateVariable(idx, v)}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}
    </div>
  );
};