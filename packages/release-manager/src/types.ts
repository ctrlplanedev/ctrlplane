import type { Variable } from "./variables/types.js";

export type ReleaseIdentifier = {
  environmentId: string;
  deploymentId: string;
  resourceId: string;
};

export type Release = ReleaseIdentifier & {
  versionId: string;
  variables: Variable[];
  releaseTargetId: string;
};

export type ReleaseWithId = Release & { id: string };

export type ReleaseQueryOptions = ReleaseIdentifier;
