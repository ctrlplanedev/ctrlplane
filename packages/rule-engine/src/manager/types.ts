export interface ReleaseTarget {
  id: string;
  deploymentId: string;
  environmentId: string;
  resourceId: string;
  workspaceId: string;
  desiredVersionId: string | null;
}

export type ReleaseManager<T = { id: string; createdAt: Date }> = {
  upsertRelease: (...args: any[]) => Promise<{ created: boolean; release: T }>;
};
