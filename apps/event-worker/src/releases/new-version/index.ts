import type { ReleaseNewVersionEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";
import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";

import { getSystemResources } from "./system-resources.js";

export const createReleaseNewVersionWorker = () =>
  new Worker<ReleaseNewVersionEvent>(Channel.ReleaseNewVersion, async (job) => {
    const version = await db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.id, job.data.versionId),
      with: { deployment: true },
    });

    if (version == null) throw new Error("Version not found");

    const { deployment } = version;
    const { systemId } = deployment;

    const impactedResources = await getSystemResources(db, systemId);
    console.log(impactedResources.length);
  });
