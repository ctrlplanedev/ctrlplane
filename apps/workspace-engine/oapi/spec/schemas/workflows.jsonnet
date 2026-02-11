local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowJobAgentConfig: {
    type: 'object',
    required: ['id', 'config'],
    properties: {
      id: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
    },
  },

  WorkflowJobMatrix: {
    type: 'object',
    additionalProperties: {
      oneOf: [
        { type: 'array', items: { type: 'object', additionalProperties: true } },
        { type: 'string' },
      ],
    },
  },

  WorkflowJobTemplate: {
    type: 'object',
    required: ['id', 'name', 'ref', 'config'],
    properties: {
      name: { type: 'string' },
      id: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      matrix: openapi.schemaRef('WorkflowJobMatrix'),
      'if': { type: 'string', description: 'CEL expression to determine if the job should run' },
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
          default: openapi.schemaRef('Selector'),
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

  Workflow: {
    type: 'object',
    required: ['id', 'name', 'inputs', 'jobs'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowJobTemplate'),
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

  WorkflowJob: {
    type: 'object',
    required: ['id', 'workflowRunId', 'index', 'ref', 'config'],
    properties: {
      id: { type: 'string' },
      index: { type: 'integer' },
      workflowRunId: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
    },
  },

  WorkflowRunWithJobs: {
    allOf: [
      openapi.schemaRef('WorkflowRun'),
      {
        type: 'object',
        required: ['jobs'],
        properties: {
          jobs: { type: 'array', items: openapi.schemaRef('WorkflowJobWithJobs') },
        },
      },
    ],
  },

  WorkflowJobWithJobs: {
    allOf: [
      openapi.schemaRef('WorkflowJob'),
      {
        type: 'object',
        required: ['jobs'],
        properties: {
          jobs: { type: 'array', items: openapi.schemaRef('Job') },
        },
      },
    ],
  },
}
