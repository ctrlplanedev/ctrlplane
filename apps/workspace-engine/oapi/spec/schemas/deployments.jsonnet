local openapi = import '../lib/openapi.libsonnet';

{
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
    discriminator: {
      propertyName: 'type',
      mapping: {
        'github-app': '#/components/schemas/DeploymentGithubJobAgentConfig',
        'argo-cd': '#/components/schemas/DeploymentArgoCDJobAgentConfig',
        tfe: '#/components/schemas/DeploymentTerraformCloudJobAgentConfig',
        custom: '#/components/schemas/DeploymentCustomJobAgentConfig',
      },
    },
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

  DeploymentWithVariables: {
    type: 'object',
    required: ['deployment', 'variables'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      variables: { type: 'array', items: openapi.schemaRef('DeploymentVariableWithValues') },
    },
  },

  DeploymentAndSystem: {
    type: 'object',
    required: ['deployment', 'system'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      system: openapi.schemaRef('System'),
    },
  },

  DeploymentVariable: {
    type: 'object',
    required: ['id', 'key', 'deploymentId'],
    properties: {
      id: { type: 'string' },
      key: { type: 'string' },
      description: { type: 'string' },
      deploymentId: { type: 'string' },
      defaultValue: openapi.schemaRef('LiteralValue'),
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

  DeploymentVariableValue: {
    type: 'object',
    required: ['id', 'deploymentVariableId', 'priority', 'value'],
    properties: {
      id: { type: 'string' },
      deploymentVariableId: { type: 'string' },
      priority: { type: 'integer', format: 'int64' },
      resourceSelector: openapi.schemaRef('Selector'),
      value: openapi.schemaRef('Value'),
    },
  },

  DeploymentVersion: {
    type: 'object',
    required: [
      'id',
      'name',
      'tag',
      'config',
      'jobAgentConfig',
      'deploymentId',
      'status',
      'createdAt',
      'metadata',
    ],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      tag: { type: 'string' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
        description: 'DeploymentVersion-specific overrides applied on top of JobAgent.config. See JobAgentConfig for typed config shapes.',
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      deploymentId: { type: 'string' },
      status: openapi.schemaRef('DeploymentVersionStatus'),
      message: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
}
