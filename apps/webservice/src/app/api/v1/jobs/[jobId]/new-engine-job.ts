import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";

export const getNewEngineJob = async (db: Tx, jobId: string) => {
  const jobResult = await db.query.job.findFirst({
    where: eq(schema.job.id, jobId),
    with: {
      releaseJob: {
        with: {
          release: {
            with: {
              variableSetRelease: {
                with: {
                  values: {
                    with: {
                      variableValueSnapshot: true,
                    },
                  },
                },
              },
              versionRelease: {
                with: {
                  version: true,
                  releaseTarget: {
                    with: {
                      resource: {
                        with: { metadata: true },
                      },
                      deployment: true,
                      environment: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (jobResult == null) return null;

  const { releaseJob, ...job } = jobResult;
  const { release } = releaseJob;
  const { versionRelease, variableSetRelease } = release;
  const { version, releaseTarget } = versionRelease;

  const { values } = variableSetRelease;
  const jobVariables = Object.fromEntries(
    values.map(({ variableValueSnapshot }) => {
      const { key, value, sensitive } = variableValueSnapshot;
      const strval = String(value);
      const resolvedValue = sensitive
        ? variablesAES256().decrypt(strval)
        : strval;
      return [key, resolvedValue];
    }),
  );

  const { environment, resource, deployment } = releaseTarget;
  const metadata = Object.fromEntries(
    resource.metadata.map(({ key, value }) => [key, value]),
  );
  const resourceWithMetadata = { ...resource, metadata };

  return {
    ...job,
    variables: jobVariables,
    resource: resourceWithMetadata,
    environment,
    deployment,
    deploymentVersion: version,
    release: { ...release, version: version.tag },
  };
};
