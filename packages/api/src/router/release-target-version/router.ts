import { createTRPCRouter } from "../../trpc";
import { forceDeployVersion } from "./force-deploy-version";
import { inProgressVersion } from "./in-progress-version";
import { latestVersion } from "./latest-version";
import { listDeployableVersions } from "./list-deployable-versions";
import { pinVersion, unpinVersion } from "./version-pinning";

export const releaseTargetVersionRouter = createTRPCRouter({
  inProgress: inProgressVersion,
  latest: latestVersion,
  list: listDeployableVersions,
  pin: pinVersion,
  unpin: unpinVersion,
  forceDeploy: forceDeployVersion,
});
