local openapi = import '../lib/openapi.libsonnet';

local Job = {
  type: 'object',
  required: [
    'id',
    'releaseId',
    'workflowJobId',
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
    workflowJobId: { type: 'string' },
    jobAgentId: { type: 'string' },
    jobAgentConfig: openapi.schemaRef('JobAgentConfig'),
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

  GithubJobAgentConfig: {
    type: 'object',
    required: ['installationId', 'owner', 'repo', 'workflowId'],
    properties: {
      installationId: { type: 'integer', format: 'int', description: 'GitHub app installation ID.' },
      owner: { type: 'string', description: 'GitHub repository owner.' },
      repo: { type: 'string', description: 'GitHub repository name.' },
      ref: { type: 'string', description: 'Git ref to run the workflow on (defaults to "main" if omitted).' },
      workflowId: { type: 'integer', format: 'int64', description: 'GitHub Actions workflow ID.' },
    },
  },

  ArgoCDJobAgentConfig: {
    type: 'object',
    required: ['serverUrl', 'apiKey', 'template'],
    properties: {
      serverUrl: { type: 'string', description: 'ArgoCD server address (host[:port] or URL).' },
      apiKey: { type: 'string', description: 'ArgoCD API token.' },
      template: { type: 'string', description: 'ArgoCD application template.' },
    },
  },

  ArgoWorkflowsJobAgentConfig: {
    type: 'object',
    required: ['serverUrl', 'apiKey', 'template'],
    properties: {
      serverUrl: { type: 'string', description: 'Argo Workflows server address (host[:port] or URL).' },
      apiKey: { type: 'string', description: 'Argo Workflows API token.' },
      namespace: { type: 'string', description: 'Kubernetes namespace for workflow execution (defaults to "default" if omitted).' },
      template: { type: 'string', description: 'Argo Workflow template.' },
    },
  },

  TerraformCloudJobAgentConfig: {
    type: 'object',
    required: ['address', 'organization', 'token', 'template'],
    properties: {
      address: { type: 'string', description: 'Terraform Cloud address (e.g. https://app.terraform.io).' },
      organization: { type: 'string', description: 'Terraform Cloud organization name.' },
      token: { type: 'string', description: 'Terraform Cloud API token.' },
      template: { type: 'string', description: 'Terraform Cloud workspace template.' },
    },
  },

  TestRunnerJobAgentConfig: {
    type: 'object',
    properties: {
      delaySeconds: { type: 'integer', format: 'int', description: 'Delay in seconds before resolving the job.' },
      status: { type: 'string', description: 'Final status to set (e.g. "successful", "failure").' },
      message: { type: 'string', description: 'Optional message to include in the job output.' },
    },
  },
}
