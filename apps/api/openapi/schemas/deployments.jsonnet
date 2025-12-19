local openapi = import '../lib/openapi.libsonnet';

{
  CreateDeploymentRequest: {
    type: 'object',
    required: ['systemId', 'slug', 'name'],
    properties: {
      systemId: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: openapi.schemaRef('DeploymentJobAgentConfig'),
      resourceSelector: openapi.schemaRef('Selector'),
    },
  },
  UpsertDeploymentRequest: {
    type: 'object',
    required: ['systemId', 'slug', 'name'],
    properties: {
      systemId: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: openapi.schemaRef('DeploymentJobAgentConfig'),
      resourceSelector: openapi.schemaRef('Selector'),
    },
  },
  Deployment: {
    type: 'object',
    required: ['id', 'name', 'slug', 'systemId', 'jobAgentConfig'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      systemId: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: openapi.schemaRef('DeploymentJobAgentConfig'),
      resourceSelector: openapi.schemaRef('Selector'),
    },
  },

  DeploymentJobAgentConfig: {
    oneOf: [
      openapi.schemaRef('DeploymentGithubJobAgentConfig'),
      openapi.schemaRef('DeploymentArgoCDJobAgentConfig'),
      openapi.schemaRef('DeploymentTerraformCloudJobAgentConfig'),
      openapi.schemaRef('DeploymentCustomJobAgentConfig'),
    ],
  },

  DeploymentGithubJobAgentConfig: {
    type: 'object',
    required: ['type', 'repo', 'workflowId'],
    properties: {
      type: {
        type: 'string',
        enum: ['github-app'],
        description: 'Deployment job agent type discriminator.',
      },
      repo: { type: 'string', description: 'GitHub repository name.' },
      workflowId: { type: 'integer', format: 'int64', description: 'GitHub Actions workflow ID.' },
      ref: { type: 'string', description: 'Git ref to run the workflow on (defaults to "main" if omitted).' },
    },
  },

  DeploymentArgoCDJobAgentConfig: {
    type: 'object',
    required: ['type', 'template'],
    properties: {
      type: {
        type: 'string',
        enum: ['argo-cd'],
        description: 'Deployment job agent type discriminator.',
      },
      template: { type: 'string', description: 'ArgoCD Application YAML/JSON template (supports Go templates).' },
    },
  },

  DeploymentTerraformCloudJobAgentConfig: {
    type: 'object',
    required: ['type', 'template'],
    properties: {
      type: {
        type: 'string',
        enum: ['tfe'],
        description: 'Deployment job agent type discriminator.',
      },
      template: { type: 'string', description: 'Terraform Cloud workspace template (YAML/JSON; supports Go templates).' },
    },
  },

  DeploymentCustomJobAgentConfig: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['custom'],
        description: 'Deployment job agent type discriminator.',
      },
    },
    additionalProperties: true,
  },
  DeploymentAndSystem: {
    type: 'object',
    required: ['deployment', 'system'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      system: openapi.schemaRef('System'),
    },
  },
  DeploymentWithVariables: {
    type: 'object',
    required: ['deployment', 'variables'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      variables: { type: 'array', items: openapi.schemaRef('DeploymentVariableWithValues') },
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
}
