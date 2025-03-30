export type ReleaseIdentifier = {
  environmentId: string;
  deploymentId: string;
  resourceId: string;
};

export type Variable<T = any> = {
  id: string;
  key: string;
  value: T;
  sensitive: boolean;
};

export type Release = ReleaseIdentifier & {
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

export type VariableProviderOptions = ReleaseIdentifier & {
  db?: any;
};

export interface ReleaseRepository {
  getLatestRelease(
    options: ReleaseIdentifier,
  ): Promise<(Release & { id: string }) | null>;
  createRelease(release: Release): Promise<Release & { id: string }>;
  setDesiredRelease(
    options: ReleaseIdentifier & { desiredReleaseId: string },
  ): Promise<any>;
}

export type ReleaseQueryOptions = ReleaseIdentifier;
