import fs from "fs";
import path from "path";
import { compile } from "handlebars";
import yaml from "js-yaml";
import { z } from "zod";

export type DeploymentVariableFixture = z.infer<
  typeof DeploymentVariableFixture
>;
export type DeploymentVersionFixture = z.infer<typeof DeploymentVersionFixture>;
export type DeploymentFixture = z.infer<typeof DeploymentFixture>;
export type EnvironmentFixture = z.infer<typeof EnvironmentFixture>;
export type SystemFixture = z.infer<typeof SystemFixture>;
export type ResourceFixture = z.infer<typeof ResourceFixture>;
export type PolicyFixture = z.infer<typeof PolicyFixture>;
export type AgentFixture = z.infer<typeof AgentFixture>;
export type EntityFixtures = z.infer<typeof EntityFixtures>;

export const DeploymentVariableFixture = z.object({
  key: z.string(),
  description: z.string().optional(),
  config: z.record(z.any()),
  values: z
    .array(
      z.object({
        value: z.any(),
        valueType: z.enum(["direct", "reference"]).optional(),
        sensitive: z.boolean().optional(),
        resourceSelector: z.any().optional(),
        default: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const DeploymentVersionFixture = z.object({
  tag: z.string(),
  name: z.string().optional(),
  config: z.record(z.any()).optional(),
  metadata: z.record(z.string()).optional(),
  status: z.enum(["building", "ready", "failed"]).optional(),
  message: z.string().optional(),
});

export const DeploymentFixture = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  resourceSelector: z.any().optional(),
  versions: z.array(DeploymentVersionFixture).optional(),
  variables: z.array(DeploymentVariableFixture).optional(),
});

export const EnvironmentFixture = z.object({
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  resourceSelector: z.any().optional(),
});

export const SystemFixture = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
});

export const ResourceFixture = z.object({
  name: z.string(),
  kind: z.string(),
  identifier: z.string(),
  version: z.string(),
  config: z.record(z.any()),
  metadata: z.record(z.string()).optional(),
});

export const PolicyFixture = z.object({
  name: z.string(),
  targets: z.array(
    z.object({
      environmentSelector: z.any().optional(),
      deploymentSelector: z.any().optional(),
      resourceSelector: z.any().optional(),
    }),
  ),
  versionAnyApprovals: z
    .array(
      z.object({
        requiredApprovalsCount: z.number(),
      }),
    )
    .optional(),
  denyWindows: z
    .array(
      z.object({
        timeZone: z.string(),
        rrule: z.any(),
      }),
    )
    .optional(),
});

export const AgentFixture = z.object({
  name: z.string(),
  type: z.string(),
});

export const EntityFixtures = z.object({
  system: SystemFixture,
  environments: z.array(EnvironmentFixture).optional(),
  resources: z.array(ResourceFixture).optional(),
  deployments: z.array(DeploymentFixture).optional(),
  policies: z.array(PolicyFixture).optional(),
  agents: z.array(AgentFixture).optional(),
});

export function importEntityFixtures(
  yamlFilePath: string,
  prefix: string,
): EntityFixtures {
  const resolvedPath = path.isAbsolute(yamlFilePath)
    ? yamlFilePath
    : path.resolve(process.cwd(), yamlFilePath);

  const fileContent = fs.readFileSync(resolvedPath, "utf8");
  const template = compile(fileContent);
  const fileTemplated = template({ prefix });
  const data = yaml.load(fileTemplated);
  const parseResult = EntityFixtures.safeParse(data);
  if (!parseResult.success) {
    throw new Error(
      `Failed to parse entity fixtures in ${yamlFilePath}: ${parseResult.error.message}`,
    );
  }
  return parseResult.data;
}
