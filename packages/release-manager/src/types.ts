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

export type VariableProviderFactory = {
  create(options: VariableProviderOptions): VariableProvider;
};

export type VariableProviderOptions = {
  resourceId: string;
  deploymentId: string;
  environmentId: string;
  db?: any;
};

export interface ReleaseRepository {
  getLatestRelease(options: ReleaseQueryOptions): Promise<Release & { id: string } | null>;
  createRelease(release: Release): Promise<Release & { id: string }>;
  setDesiredRelease(options: ReleaseQueryOptions & { desiredReleaseId: string }): Promise<any>;
}

export type ReleaseQueryOptions = {
  environmentId: string;
  deploymentId: string;
  resourceId: string;
};