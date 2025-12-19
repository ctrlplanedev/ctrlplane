local openapi = import '../lib/openapi.libsonnet';

{
  UpsertJobAgentRequest: {
    type: 'object',
    required: ['name', 'type', 'config'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      metadata: { 
        type: 'object', 
        additionalProperties: { type: 'string' }
      },
      config: openapi.schemaRef('JobAgentConfig'),
    },
  },
  JobAgent: {
    type: 'object',
    required: ['id', 'name', 'type', 'config', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: openapi.schemaRef('JobAgentConfig'),
      metadata: { 
        type: 'object', 
        additionalProperties: { type: 'string' }
      },
    },
  },

  JobAgentConfig: {
    oneOf: [
      openapi.schemaRef('GithubJobAgentConfig'),
      openapi.schemaRef('ArgoCDJobAgentConfig'),
      openapi.schemaRef('TerraformCloudJobAgentConfig'),
      openapi.schemaRef('TestRunnerJobAgentConfig'),
      openapi.schemaRef('CustomJobAgentConfig'),
    ],
  },

  GithubJobAgentConfig: {
    type: 'object',
    required: ['type', 'installationId', 'owner'],
    properties: {
      type: {
        type: 'string',
        enum: ['github-app'],
        description: 'Job agent type discriminator.',
      },
      installationId: { type: 'integer', format: 'int' },
      owner: { type: 'string' },
    },
  },

  ArgoCDJobAgentConfig: {
    type: 'object',
    required: ['type', 'serverUrl', 'apiKey'],
    properties: {
      type: {
        type: 'string',
        enum: ['argo-cd'],
        description: 'Job agent type discriminator.',
      },
      serverUrl: { type: 'string', description: 'ArgoCD server address (host[:port] or URL).' },
      apiKey: { type: 'string', description: 'ArgoCD API token.' },
    },
  },

  TerraformCloudJobAgentConfig: {
    type: 'object',
    required: ['type', 'address', 'token', 'organization'],
    properties: {
      type: {
        type: 'string',
        enum: ['tfe'],
        description: 'Job agent type discriminator.',
      },
      organization: { type: 'string', description: 'Terraform Cloud organization name.' },
      address: { type: 'string', description: 'Terraform Cloud address (e.g. https://app.terraform.io).' },
      token: { type: 'string', description: 'Terraform Cloud API token.' },
      template: { type: 'string', description: 'Terraform Cloud workspace template (YAML/JSON; supports Go templates).' },
    },
    additionalProperties: true,
  },

  TestRunnerJobAgentConfig: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['test-runner'],
        description: 'Job agent type discriminator.',
      },
      delaySeconds: { type: 'integer', format: 'int', description: 'Delay before resolving the job.' },
      status: { type: 'string', enum: ['completed', 'failure'], description: 'Final status to set.' },
      message: { type: 'string', description: 'Optional message to include in the job output.' },
    },
  },

  CustomJobAgentConfig: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['custom'],
        description: 'Job agent type discriminator.',
      },
    },
    additionalProperties: true,
  },
}