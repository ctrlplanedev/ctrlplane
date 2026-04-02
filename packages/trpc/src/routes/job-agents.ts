import { TRPCError } from "@trpc/server";
import z from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

const jobAgentConfig = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("github-app"),
    installationId: z.number(),
    owner: z.string(),
  }),
  z.object({
    type: z.literal("argo-cd"),
    apiKey: z.string(),
    serverUrl: z.string(),
  }),
  z
    .object({
      type: z.literal("tfe"),
      address: z.string(),
      organization: z.string(),
      token: z.string(),
      template: z.string().optional(),
    })
    .passthrough(),
  z.object({
    type: z.literal("test-runner"),
    delaySeconds: z.number().optional(),
    message: z.string().optional(),
    status: z.enum(["completed", "failure"]).optional(),
  }),
  z.object({ type: z.literal("custom") }).passthrough(),
]);

export const jobAgentsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const jobAgents = await ctx.db.query.jobAgent.findMany({
        where: eq(schema.jobAgent.workspaceId, input.workspaceId),
      });
      return jobAgents;
    }),

  get: protectedProcedure
    .input(z.object({ jobAgentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const jobAgent = await ctx.db.query.jobAgent.findFirst({
        where: eq(schema.jobAgent.id, input.jobAgentId),
      });
      if (jobAgent == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job agent not found",
        });
      return jobAgent;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        name: z.string(),
        type: z.string(),
        config: jobAgentConfig,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const jobAgent = await ctx.db
        .insert(schema.jobAgent)
        .values(input)
        .returning()
        .then(takeFirst);
      return jobAgent;
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), jobAgentId: z.string() }))
    .mutation(async ({ input: { jobAgentId }, ctx }) => {
      const [jobAgent] = await ctx.db
        .delete(schema.jobAgent)
        .where(eq(schema.jobAgent.id, jobAgentId))
        .returning();

      if (jobAgent == null) throw new Error("Job agent not found");

      return jobAgent;
    }),

  deployments: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), jobAgentId: z.string() }))
    .query(({ input, ctx }) =>
      ctx.db
        .select({ deployment: schema.deployment })
        .from(schema.deploymentJobAgent)
        .innerJoin(
          schema.deployment,
          eq(schema.deploymentJobAgent.deploymentId, schema.deployment.id),
        )
        .where(eq(schema.deploymentJobAgent.jobAgentId, input.jobAgentId)),
    ),
});
