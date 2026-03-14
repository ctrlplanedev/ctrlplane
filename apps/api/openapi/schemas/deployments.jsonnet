local openapi = import '../lib/openapi.libsonnet';

local jobAgentConfig = {
  type: 'object',
  additionalProperties: true,
};

{
  DeploymentJobAgent: {
    type: 'object',
    required: ['ref', 'config', 'selector'],
    properties: {
      ref: { type: 'string' },
      config: openapi.schemaRef('JobAgentConfig'),
      selector: { type: 'string', description: 'CEL expression to determine if the job agent should be used' },
    },
  },

  CreateDeploymentRequest: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      jobAgents: { type: 'array', items: openapi.schemaRef('DeploymentJobAgent') },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the deployment should be used' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  UpsertDeploymentRequest: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      jobAgents: { type: 'array', items: openapi.schemaRef('DeploymentJobAgent') },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the deployment should be used' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },

  Deployment: {
    type: 'object',
    required: ['id', 'name', 'slug', 'jobAgentConfig'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: jobAgentConfig,
      jobAgents: { type: 'array', items: openapi.schemaRef('DeploymentJobAgent') },
      resourceSelector: { type: 'string', description: 'CEL expression to determine if the deployment should be used' },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentAndSystems: {
    type: 'object',
    required: ['deployment', 'systems'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      systems: { type: 'array', items: openapi.schemaRef('System') },
    },
  },

  DeploymentWithVariablesAndSystems: {
    type: 'object',
    required: ['deployment', 'variables', 'systems'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      variables: { type: 'array', items: openapi.schemaRef('DeploymentVariableWithValues') },
      systems: { type: 'array', items: openapi.schemaRef('System') },
    },
  },

  DeploymentVariableWithValues: {
    type: 'object',
    required: ['variable', 'values'],
    properties: {
      variable: openapi.schemaRef('DeploymentVariable'),
      values: { type: 'array', items: openapi.schemaRef('DeploymentVariableValue') },
    },
  },

  CreateDeploymentPlanRequest: {
    type: 'object',
    required: ['version'],
    properties: {
      version: openapi.schemaRef('DeploymentPlanVersion'),
      metadata: { type: 'object', additionalProperties: { type: 'string' }, description: 'Arbitrary key-value metadata for the plan (e.g. GitHub PR links, CI run URLs)' },
    },
  },

  DeploymentPlanVersion: {
    type: 'object',
    required: ['tag'],
    properties: {
      name: { type: 'string', description: 'Display name for the proposed version (defaults to tag if omitted)' },
      tag: { type: 'string', description: 'Version tag for the proposed deployment (e.g. pr-123-abc123)' },
      config: { type: 'object', additionalProperties: true },
      jobAgentConfig: { type: 'object', additionalProperties: true },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },

  DeploymentPlanTarget: {
    type: 'object',
    required: ['environmentId', 'environmentName', 'resourceId', 'resourceName', 'status'],
    properties: {
      environmentId: { type: 'string' },
      environmentName: { type: 'string' },
      resourceId: { type: 'string' },
      resourceName: { type: 'string' },
      status: { type: 'string', enum: ['computing', 'completed', 'errored', 'unsupported'] },
      hasChanges: { type: 'boolean', nullable: true },
      contentHash: { type: 'string', description: 'Hash of the rendered output for change detection' },
      current: { type: 'string', description: 'Full rendered output of the currently deployed state' },
      proposed: { type: 'string', description: 'Full rendered output of the proposed version' },
    },
  },

  DeploymentPlanSummary: {
    type: 'object',
    required: ['total', 'changed', 'unchanged', 'errored'],
    properties: {
      total: { type: 'integer' },
      changed: { type: 'integer' },
      unchanged: { type: 'integer' },
      errored: { type: 'integer' },
      unsupported: { type: 'integer' },
    },
  },

  DeploymentPlan: {
    type: 'object',
    required: ['id', 'status', 'targets'],
    properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['computing', 'completed', 'failed'] },
      summary: openapi.schemaRef('DeploymentPlanSummary', nullable=true),
      targets: {
        type: 'array',
        items: openapi.schemaRef('DeploymentPlanTarget'),
      },
    },
  },
}
