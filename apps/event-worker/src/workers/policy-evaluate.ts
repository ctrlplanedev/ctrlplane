import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { Channel, createWorker } from "@ctrlplane/events";
import { DatabaseReleaseRepository, evaluate } from "@ctrlplane/rule-engine";
import { createCtx } from "@ctrlplane/rule-engine/db";

export const policyEvaluate = createWorker(
  Channel.EvaluateReleaseTarget,
  async (job) => {
    const ctx = await createCtx(db, job.data);
    if (!ctx) {
      throw new Error("Failed to create context");
    }
    const releaseRepository = await DatabaseReleaseRepository.create({
      ...ctx,
      workspaceId: ctx.resource.workspaceId,
    });
    const release = await releaseRepository.getNewestRelease();
    const policy = await releaseRepository.getPolicy();
    const releases = await releaseRepository
      .getApplicableReleases(policy)
      .then((r) =>
        r.map((r) => ({
          ...r,
          version: {
            ...r.version,
            metadata: _(r.version.metadata)
              .map((v) => [v.key, v.value])
              .fromPairs()
              .value(),
          },
          variables: _(r.variables)
            .map((v) => [v.key, v.value])
            .fromPairs()
            .value(),
        })),
      );

    if (release != null) await releaseRepository.setDesired(release.versionId);
    await evaluate(policy, ctx, () => releases);
  },
);
