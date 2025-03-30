export type Variable<T = any> = {
  id: string;
  key: string;
  value: T;
  sensitive: boolean;
};

export type Release = {
  resourceId: string;
  deploymentId: string;
  environmentId: string;
  versionId: string;
  variables: Variable[];
};

export type MaybePromise<T> = T | Promise<T>;
export type MaybeVariable = Variable | null;

export type VariableProvider = {
  getVariable(key: string): MaybePromise<MaybeVariable>;
};
