"use client";

import type {
  BooleanVariableConfigType,
  ChoiceVariableConfigType,
  StringVariableConfigType,
  VariableConfigType,
} from "@ctrlplane/validators/variables";
import _ from "lodash";
import { TbX } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import { Checkbox } from "@ctrlplane/ui/checkbox";
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

export const ConfigTypeSelector: React.FC<{
  value: string | undefined;
  onChange: (type: string) => void;
}> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="string">String</SelectItem>
        <SelectItem value="number">Number</SelectItem>
        <SelectItem value="boolean">Boolean</SelectItem>
        <SelectItem value="choice">Choice</SelectItem>
      </SelectContent>
    </Select>
  );
};

type ConfigFieldsFC<T extends VariableConfigType> = React.FC<{
  config: T;
  updateConfig: (updates: Partial<T>) => void;
  setConfig: (value: T) => void;
}>;

export const StringConfigFields: ConfigFieldsFC<StringVariableConfigType> = ({
  config,
  updateConfig,
}) => (
  <>
    <FormItem>
      <FormLabel>Input Type</FormLabel>
      <FormControl>
        <Select
          value={config.inputType}
          onValueChange={(value) => updateConfig({ inputType: value as any })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select input type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="text-area">Text Area</SelectItem>
          </SelectContent>
        </Select>
      </FormControl>
    </FormItem>

    <FormItem>
      <FormLabel>Value</FormLabel>
      <FormControl>
        <>
          {config.inputType === "text" && (
            <Input
              type="text"
              placeholder="Enter text"
              value={config.default ?? ""}
              onChange={(e) => updateConfig({ default: e.target.value })}
            />
          )}
          {config.inputType === "text-area" && (
            <Textarea
              placeholder="Enter text"
              value={config.default ?? ""}
              onChange={(e) => updateConfig({ default: e.target.value })}
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
        <Checkbox
          checked={config.default}
          className="inline"
          onCheckedChange={(e) => updateConfig({ default: Boolean(e) })}
        />

        {String(config.default ?? "false")}
      </div>
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
                  <TbX className="h-4 w-4" />
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
              <TbX className="h-4 w-4" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    </>
  );
};
