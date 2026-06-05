local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowJobAgent: {
    type: 'object',
    required: ['name', 'ref', 'config', 'selector'],
    properties: {
      name: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      selector: { type: 'string', description: 'CEL expression to determine if the job agent should dispatch a job' },
    },
  },

  CreateWorkflowJobAgent: {
    type: 'object',
    required: ['name', 'ref', 'config', 'selector'],
    properties: {
      name: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      selector: { type: 'string', description: 'CEL expression to determine if the job agent should dispatch a job' },
    },
  },

  WorkflowStringInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['string'] },
      default: { type: 'string' },
    },
  },

  WorkflowNumberInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['number'] },
      default: { type: 'number' },
    },
  },

  WorkflowBooleanInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['boolean'] },
      default: { type: 'boolean' },
    },
  },

  WorkflowObjectInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['object'] },
      default: { type: 'object', additionalProperties: true },
    },
  },

  WorkflowManualArrayInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['array'] },
      default: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },

  WorkflowSelectorArrayInput: {
    type: 'object',
    required: ['key', 'type', 'selector'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['array'] },
      selector: {
        type: 'object',
        required: ['entityType'],
        properties: {
          entityType: { type: 'string', enum: ['resource', 'environment', 'deployment'] },
          default: {
            type: 'string',
            description: 'CEL expression for the default selector.',
          },
        },
      },
    },
  },

  WorkflowArrayInput: {
    oneOf: [
      openapi.schemaRef('WorkflowManualArrayInput'),
      openapi.schemaRef('WorkflowSelectorArrayInput'),
    ],
  },

  WorkflowInput: {
    oneOf: [
      openapi.schemaRef('WorkflowStringInput'),
      openapi.schemaRef('WorkflowNumberInput'),
      openapi.schemaRef('WorkflowBooleanInput'),
      openapi.schemaRef('WorkflowArrayInput'),
      openapi.schemaRef('WorkflowObjectInput'),
    ],
  },

  CreateWorkflow: {
    type: 'object',
    required: ['name', 'inputs', 'jobAgents'],
    properties: {
      name: { type: 'string' },
      slug: { type: 'string', description: 'URL-safe identifier unique within the workspace. Derived from name if omitted.' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobAgents: {
        type: 'array',
        items: openapi.schemaRef('CreateWorkflowJobAgent'),
      },
    },
  },

  UpdateWorkflow: {
    type: 'object',
    required: ['name', 'inputs', 'jobAgents'],
    properties: {
      name: { type: 'string' },
      slug: { type: 'string', description: 'URL-safe identifier unique within the workspace.' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobAgents: {
        type: 'array',
        items: openapi.schemaRef('CreateWorkflowJobAgent'),
      },
    },
  },

  Workflow: {
    type: 'object',
    required: ['id', 'name', 'slug', 'inputs', 'jobAgents'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobAgents: {
        type: 'array',
        items: openapi.schemaRef('WorkflowJobAgent'),
      },
    },
  },

  WorkflowRun: {
    type: 'object',
    required: ['id', 'workflowId', 'inputs'],
    properties: {
      id: { type: 'string' },
      workflowId: { type: 'string' },
      inputs: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },

  WorkflowRunJob: {
    type: 'object',
    required: ['jobId', 'jobAgentId'],
    properties: {
      jobId: { type: 'string', description: 'Job id; poll its status via GET /v1/workspaces/{workspaceId}/jobs/{jobId}' },
      jobAgentId: { type: 'string', description: 'Job agent the job was dispatched to' },
    },
  },

  WorkflowRunResult: {
    type: 'object',
    required: ['id', 'workflowId', 'inputs', 'jobs'],
    properties: {
      id: { type: 'string', description: 'Workflow run id' },
      workflowId: { type: 'string' },
      inputs: {
        type: 'object',
        additionalProperties: true,
      },
      jobs: {
        type: 'array',
        description: 'Jobs created and dispatched for this run',
        items: openapi.schemaRef('WorkflowRunJob'),
      },
    },
  },

  WorkflowSlugConflictResponse: {
    type: 'object',
    required: ['message', 'code', 'details'],
    properties: {
      message: { type: 'string' },
      code: { type: 'string', enum: ['DUPLICATE_SLUG'] },
      details: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', description: 'The slug that collided.' },
          existingWorkflowId: {
            type: 'string',
            description: 'UUID of the workflow that already uses this slug, if known.',
          },
        },
      },
    },
  },

  WorkflowJob: {
    type: 'object',
    required: ['id', 'workflowId', 'index', 'ref', 'config'],
    properties: {
      id: { type: 'string' },
      index: { type: 'integer' },
      workflowId: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
    },
  },
}
