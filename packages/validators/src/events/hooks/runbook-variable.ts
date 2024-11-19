import type { RunbookVariableConfigType } from "../../variables";

// Cannot import from db package as it will create circular dependency
export type RunbookVariable = {
  key: string;
  name: string;
  config: RunbookVariableConfigType;
};
