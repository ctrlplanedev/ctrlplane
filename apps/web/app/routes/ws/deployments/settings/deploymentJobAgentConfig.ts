import { z } from "zod";

export const githubAppJobAgentConfig = z.object({
  type: z.literal("github-app"),
  repo: z.string(),
  workflowId: z.number(),
  ref: z.string().optional(),
});

export const argoCdJobAgentConfig = z.object({
  type: z.literal("argo-cd"),
  template: z.string(),
});

export const argoWorkflowsJobAgentConfig = z.object({
  type: z.literal("argo-workflows"),
  template: z.string(),
});

export const tfeJobAgentConfig = z.object({
  type: z.literal("tfe"),
  template: z.string(),
});

export const customJobAgentConfig = z
  .object({ type: z.literal("custom") })
  .passthrough();

export const deploymentJobAgentConfig = z.discriminatedUnion("type", [
  githubAppJobAgentConfig,
  argoCdJobAgentConfig,
  argoWorkflowsJobAgentConfig,
  tfeJobAgentConfig,
  customJobAgentConfig,
]);
