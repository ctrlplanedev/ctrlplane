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
    dispatchContext: openapi.schemaRef('DispatchContext'),
  },
};

local JobPropertyKeys = std.objectFields(Job.properties);

{
  Job: Job,

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
      inputs: {
        type: 'object',
        additionalProperties: true,
        description: 'Resolved input values for the workflow run.',
      },
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

  TerraformCloudJobAgentConfig: {
    type: 'object',
    required: ['address', 'organization', 'token', 'template', 'webhookUrl'],
    properties: {
      address: { type: 'string', description: 'Terraform Cloud address (e.g. https://app.terraform.io).' },
      organization: { type: 'string', description: 'Terraform Cloud organization name.' },
      token: { type: 'string', description: 'Terraform Cloud API token.' },
      template: { type: 'string', description: 'Terraform Cloud workspace template.' },
      webhookUrl: { type: 'string', description: 'The ctrlplane API endpoint for TFC webhook notifications (e.g. https://ctrlplane.example.com/api/tfe/webhook).' },
      triggerRunOnChange: { type: 'boolean', default: true, description: 'Whether to create a TFC run on dispatch. When false, only the workspace and variables are synced.' },
    },
  },

  ArgoWorkflowJobAgentConfig: {
    oneOf: [
      {
        type: 'object',
        description: 'Inline workflow execution',
        required: ['serverUrl', 'apiKey', 'template', 'name'],
        properties: {
          name: { type: 'string', description: 'ArgoWorkflow job name' },
          inline: {
            type: 'boolean',
            enum: [true],
            description: 'Execute inline workflow (defaults to false if omitted)',
          },
          serverUrl: { type: 'string', description: 'ArgoWorkflow server address (host[:port] or URL).' },
          apiKey: { type: 'string', description: 'ArgoWorkflow API token.' },
          template: { type: 'string', description: 'Inline workflow spec or template.' },
        },
        additionalProperties: false,
      },
      {
        type: 'object',
        description: 'WorkflowTemplate reference execution',
        required: ['serverUrl', 'apiKey', 'template', 'name', 'namespace'],
        properties: {
          name: { type: 'string', description: 'ArgoWorkflow job name' },
          inline: {
            type: 'boolean',
            enum: [false],
            description: 'Use WorkflowTemplate reference (default mode)',
          },
          serverUrl: { type: 'string', description: 'ArgoWorkflow server address (host[:port] or URL).' },
          apiKey: { type: 'string', description: 'ArgoWorkflow API token.' },
          template: { type: 'string', description: 'WorkflowTemplate name.' },
          namespace: { type: 'string', description: 'WorkflowTemplate namespace' },
        },
        additionalProperties: false,
      },
    ],
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
