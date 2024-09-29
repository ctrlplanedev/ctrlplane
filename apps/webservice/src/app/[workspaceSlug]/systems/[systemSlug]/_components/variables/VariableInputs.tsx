import type {
  ChoiceVariableConfigType,
  StringVariableConfigType,
} from "@ctrlplane/validators/variables";

import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

export const VariableStringInput: React.FC<
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

export const VariableChoiceSelect: React.FC<
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

export const VariableBooleanInput: React.FC<{
  value: boolean | null;
  onChange: (v: boolean) => void;
}> = ({ value, onChange }) => {
  return (
    <Select
      value={value ? value.toString() : undefined}
      onValueChange={(v) => onChange(v === "true")}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">True</SelectItem>
        <SelectItem value="false">False</SelectItem>
      </SelectContent>
    </Select>
  );
};

export const VariableNumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.valueAsNumber)}
    />
  );
};
