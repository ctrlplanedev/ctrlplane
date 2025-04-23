import { Channel, createWorker, getQueue } from "@ctrlplane/events";

// const recomputeReleaseTargets = async (environment: schema.Environment) => {
//   const computeBuilder = selector().compute();
//   await computeBuilder.environments([environment]).resourceSelectors();
//   const { systemId } = environment;
//   const system = await db
//     .select()
//     .from(schema.system)
//     .where(eq(schema.system.id, systemId))
//     .then(takeFirst);
//   const { workspaceId } = system;
//   return computeBuilder.allResources(workspaceId).releaseTargets();
// };

export const newEnvironmentWorker = createWorker(
  Channel.NewEnvironment,
  async (job) => {
    const { data: environment } = job;

    await getQueue(Channel.ComputeEnvironmentResourceSelector).add(
      environment.id,
      environment,
      { jobId: environment.id },
    );
  },
);
