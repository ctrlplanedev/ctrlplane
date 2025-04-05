export type Variable<T = any> = {
  id?: string;
  key: string;
  value: T;
  sensitive: boolean;
};

export type MaybePromise<T> = T | Promise<T>;
export type MaybeVariable = Variable | null;

export type VariableProvider = {
  getVariable(key: string): MaybePromise<MaybeVariable>;
};
