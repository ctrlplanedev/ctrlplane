"use client";

import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type {
  BooleanVariableConfigType,
  ChoiceVariableConfigType,
  DeploymentVariableConfigType,
  EnvironmentVariableConfigType,
  NumberVariableConfigType,
  ResourceVariableConfigType,
  RunbookVariableConfigType,
  StringVariableConfigType,
  VariableConfigType,
} from "@ctrlplane/validators/variables";
import { IconX } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { FormControl, FormItem, FormLabel } from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  defaultCondition,
  isEmptyCondition,
} from "@ctrlplane/validators/resources";

import { ResourceConditionBadge } from "~/app/[workspaceSlug]/(appv2)/_components/resources/condition/ResourceConditionBadge";
import { ResourceConditionDialog } from "~/app/[workspaceSlug]/(appv2)/_components/resources/condition/ResourceConditionDialog";

export const ConfigTypeSelector: React.FC<{
  value: string | undefined;
  onChange: (type: string) => void;
  exclude?: string[];
}> = ({ value, onChange, exclude }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger>
      <SelectValue placeholder="Select type" />
    </SelectTrigger>
    <SelectContent>
      {!exclude?.includes("string") && (
        <SelectItem value="string">String</SelectItem>
      )}
      {!exclude?.includes("number") && (
        <SelectItem value="number">Number</SelectItem>
      )}
      {!exclude?.includes("boolean") && (
        <SelectItem value="boolean">Boolean</SelectItem>
      )}
      {!exclude?.includes("choice") && (
        <SelectItem value="choice">Choice</SelectItem>
      )}
    </SelectContent>
  </Select>
);

export const RunbookConfigTypeSelector: React.FC<{
  value: string | undefined;
  onChange: (type: string) => void;
}> = ({ value, onChange }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger>
      <SelectValue placeholder="Select type" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="string">String</SelectItem>
      <SelectItem value="number">Number</SelectItem>
      <SelectItem value="boolean">Boolean</SelectItem>
      <SelectItem value="choice">Choice</SelectItem>
      <SelectItem value="resource">Resource</SelectItem>
      <SelectItem value="environment">Environment</SelectItem>
    </SelectContent>
  </Select>
);

type ConfigFieldsFC<T extends VariableConfigType> = React.FC<{
  config: T;
  updateConfig: (updates: Partial<T>) => void;
}>;

export const StringConfigFields: ConfigFieldsFC<StringVariableConfigType> = ({
  config,
  updateConfig,
}) => (
  <>
    <FormItem>
      <FormLabel>Input Display</FormLabel>
      <FormControl>
        <Select
          value={config.inputType}
          onValueChange={(value) => updateConfig({ inputType: value as any })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select input display" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="text-area">Text Area</SelectItem>
          </SelectContent>
        </Select>
      </FormControl>
    </FormItem>

    <FormItem>
      <FormLabel>Default Value</FormLabel>
      <FormControl>
        <>
          {config.inputType === "text" && (
            <Input
              type="text"
              placeholder="Enter text"
              value={config.default ?? ""}
              onChange={(e) =>
                updateConfig({
                  default: e.target.value !== "" ? e.target.value : undefined,
                })
              }
            />
          )}
          {config.inputType === "text-area" && (
            <Textarea
              placeholder="Enter text"
              value={config.default ?? ""}
              onChange={(e) =>
                updateConfig({
                  default: e.target.value !== "" ? e.target.value : undefined,
                })
              }
            />
          )}
        </>
      </FormControl>
    </FormItem>
  </>
);

export const BooleanConfigFields: ConfigFieldsFC<BooleanVariableConfigType> = ({
  config,
  updateConfig,
}) => (
  <FormItem>
    <FormLabel>Default Value</FormLabel>
    <FormControl>
      <div className="flex items-center gap-2">
        <Select
          value={String(config.default ?? "")}
          onValueChange={(value) => updateConfig({ default: value === "true" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select default value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FormControl>
  </FormItem>
);

export const NumberConfigFields: ConfigFieldsFC<NumberVariableConfigType> = ({
  config,
  updateConfig,
}) => (
  <FormItem>
    <FormLabel>Default Value</FormLabel>
    <FormControl>
      <Input
        type="number"
        value={config.default ?? 0}
        onChange={(e) => updateConfig({ default: e.target.valueAsNumber })}
      />
    </FormControl>
  </FormItem>
);

export const ChoiceConfigFields: ConfigFieldsFC<ChoiceVariableConfigType> = ({
  config,
  updateConfig,
}) => {
  const addOption = () => {
    updateConfig({ options: [...config.options, ""] });
  };

  const removeOption = (index: number) => {
    const newOptions = [...config.options];
    newOptions.splice(index, 1);
    updateConfig({ options: newOptions });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...config.options];
    newOptions[index] = value;
    updateConfig({ options: newOptions });
  };

  return (
    <>
      <FormItem>
        <FormLabel>Options</FormLabel>
        <FormControl>
          <div className="space-y-2">
            {config.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(index)}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </FormControl>
      </FormItem>

      <Button type="button" variant="outline" onClick={addOption}>
        Add Option
      </Button>
      <FormItem>
        <FormLabel>Default Value</FormLabel>
        <FormControl>
          <div className="flex items-center gap-2">
            <Select
              value={config.default}
              disabled={config.options.length === 0}
              onValueChange={(value) => updateConfig({ default: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default option" />
              </SelectTrigger>
              <SelectContent>
                {config.options
                  .filter((o) => o != "")
                  .map((option, index) => (
                    <SelectItem key={index} value={option}>
                      {option}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => updateConfig({ default: "" })}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    </>
  );
};

type RunbookConfigFieldsFC<T extends RunbookVariableConfigType> = React.FC<{
  config: T;
  updateConfig: (updates: Partial<T>) => void;
}>;

export const ResourceConfigFields: RunbookConfigFieldsFC<
  ResourceVariableConfigType
> = ({ config, updateConfig }) => {
  const onFilterChange = (condition: ResourceCondition | null) => {
    const cond = condition ?? defaultCondition;
    if (isEmptyCondition(cond)) updateConfig({ ...config, filter: undefined });
    if (!isEmptyCondition(cond)) updateConfig({ ...config, filter: cond });
  };

  return (
    <>
      {config.filter && <ResourceConditionBadge condition={config.filter} />}
      <ResourceConditionDialog
        condition={config.filter ?? defaultCondition}
        onChange={onFilterChange}
      >
        <Button variant="outline">Edit Filter</Button>
      </ResourceConditionDialog>
    </>
  );
};

export const EnvironmentConfigFields: RunbookConfigFieldsFC<
  EnvironmentVariableConfigType
> = () => {
  return <></>;
};

export const DeploymentConfigFields: RunbookConfigFieldsFC<
  DeploymentVariableConfigType
> = () => {
  return <></>;
};
