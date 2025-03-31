import type { ReleaseIdentifier } from "src/types";

export type Variable<T = any> = {
  id: string;
  key: string;
  value: T;
  sensitive: boolean;
};

export type MaybePromise<T> = T | Promise<T>;
export type MaybeVariable = Variable | null;

export type VariableProvider = {
  getVariable(key: string): MaybePromise<MaybeVariable>;
};

export type VariableProviderFactory = {
  create(options: VariableProviderOptions): VariableProvider;
};

export type VariableProviderOptions = ReleaseIdentifier & {
  db?: any;
};
