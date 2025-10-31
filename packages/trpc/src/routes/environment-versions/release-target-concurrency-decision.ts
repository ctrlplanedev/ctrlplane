import type { ReleaseTargetWithEval } from "./types";

export const getReleaseTargetConcurrencyDecisions = (
  workspaceId: string,
  releaseTargetsWithEval: ReleaseTargetWithEval[],
) => {
  console.log(releaseTargetsWithEval, workspaceId);

  return [];
};
