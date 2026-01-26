local openapi = import '../lib/openapi.libsonnet';

local Job = {
  type: 'object',
  required: [
    'id',
    'releaseId',
    'taskId',
    'jobAgentId',
    'jobAgentConfig',
    'status',
    'createdAt',
    'updatedAt',
    'metadata',
  ],
  properties: {
    id: { type: 'string' },
    releaseId: { type: 'string' },
    taskId: { type: 'string' },
    jobAgentId: { type: 'string' },
    jobAgentConfig: openapi.schemaRef('FullJobAgentConfig'),
    externalId: { type: 'string' },
    traceToken: { type: 'string' },
    status: openapi.schemaRef('JobStatus'),
    message: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
    metadata: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  },
};

local JobPropertyKeys = std.objectFields(Job.properties);

{
  Job: Job,

  JobStatus: {
    type: 'string',
    enum: [
      'cancelled',
      'skipped',
      'inProgress',
      'actionRequired',
      'pending',
      'failure',
      'invalidJobAgent',
      'invalidIntegration',
      'externalRunNotFound',
      'successful',
    ],
  },

  JobWithVerifications: {
    type: 'object',
    required: ['job', 'verifications'],
    properties: {
      job: openapi.schemaRef('Job'),
      verifications: {
        type: 'array',
        items: openapi.schemaRef('JobVerification'),
      },
    },
  },

  JobWithRelease: {
    type: 'object',
    required: ['job', 'release'],
    properties: {
      job: openapi.schemaRef('Job'),
      release: openapi.schemaRef('Release'),
      environment: openapi.schemaRef('Environment'),
      deployment: openapi.schemaRef('Deployment'),
      resource: openapi.schemaRef('Resource'),
    },
  },

  JobUpdateEvent: {
    type: 'object',
    required: ['job'],
    properties: {
      id: { type: 'string' },
      agentId: { type: 'string' },
      externalId: { type: 'string' },
      job: openapi.schemaRef('Job'),
      fieldsToUpdate: { type: 'array', items: { type: 'string', enum: JobPropertyKeys } },
    },
    oneOf: [
      { required: ['id'] },
      { required: ['agentId', 'externalId'] },
    ],
  },

  FullJobAgentConfig: {
    oneOf: [
      openapi.schemaRef('FullGithubJobAgentConfig'),
      openapi.schemaRef('FullArgoCDJobAgentConfig'),
      openapi.schemaRef('FullTerraformCloudJobAgentConfig'),
      openapi.schemaRef('FullTestRunnerJobAgentConfig'),
      openapi.schemaRef('FullCustomJobAgentConfig'),
    ],
    discriminator: {
      propertyName: 'type',
      mapping: {
        'github-app': '#/components/schemas/FullGithubJobAgentConfig',
        'argo-cd': '#/components/schemas/FullArgoCDJobAgentConfig',
        tfe: '#/components/schemas/FullTerraformCloudJobAgentConfig',
        'test-runner': '#/components/schemas/FullTestRunnerJobAgentConfig',
        custom: '#/components/schemas/FullCustomJobAgentConfig',
      },
    },
  },

  FullGithubJobAgentConfig: {
    allOf: [
      openapi.schemaRef('GithubJobAgentConfig'),
      openapi.schemaRef('DeploymentGithubJobAgentConfig'),
    ],
  },

  FullArgoCDJobAgentConfig: {
    allOf: [
      openapi.schemaRef('ArgoCDJobAgentConfig'),
      openapi.schemaRef('DeploymentArgoCDJobAgentConfig'),
    ],
  },

  FullTerraformCloudJobAgentConfig: {
    allOf: [
      openapi.schemaRef('TerraformCloudJobAgentConfig'),
      openapi.schemaRef('DeploymentTerraformCloudJobAgentConfig'),
    ],
  },

  FullTestRunnerJobAgentConfig: {
    allOf: [
      openapi.schemaRef('TestRunnerJobAgentConfig'),
    ],
  },

  FullCustomJobAgentConfig: {
    allOf: [
      openapi.schemaRef('CustomJobAgentConfig'),
    ],
  },
}
