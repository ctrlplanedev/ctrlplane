local openapi = import '../lib/openapi.libsonnet';

local jobAgentConfig = {
  type: 'object',
  additionalProperties: true,
};

local Job = {
  type: 'object',
  required: [
    'id',
    'releaseId',
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
    jobAgentId: { type: 'string' },
    jobAgentConfig: jobAgentConfig,
    externalId: { type: 'string' },
    status: openapi.schemaRef('JobStatus'),
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
    metadata: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    dispatchContext: openapi.schemaRef('DispatchContext'),
  },
};

local JobPropertyKeys = std.objectFields(Job.properties);

{
  Job: Job,

  JobAgentConfig: jobAgentConfig,

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

  DispatchContext: {
    type: 'object',
    required: [
      'jobAgent',
      'jobAgentConfig',
    ],
    properties: {
      jobAgent: openapi.schemaRef('JobAgent'),
      jobAgentConfig: openapi.schemaRef('JobAgentConfig'),
      release: openapi.schemaRef('Release'),
      deployment: openapi.schemaRef('Deployment'),
      environment: openapi.schemaRef('Environment'),
      resource: openapi.schemaRef('Resource'),
      workflow: openapi.schemaRef('Workflow'),
      workflowJob: openapi.schemaRef('WorkflowJob'),
      workflowRun: openapi.schemaRef('WorkflowRun'),
      version: openapi.schemaRef('DeploymentVersion'),
      variables: {
        type: 'object',
        additionalProperties: openapi.schemaRef('LiteralValue'),
      },
    },
  },

  JobStatusRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
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
}
