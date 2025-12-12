local openapi = import '../lib/openapi.libsonnet';

{
  // ============ Variable Config Types ============

  WorkflowTemplateVariableConfigString: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['string'] },
      inputType: { type: 'string', enum: ['text', 'text-area'], default: 'text' },
      minLength: { type: 'integer' },
      maxLength: { type: 'integer' },
      default: { type: 'string' },
    },
  },

  WorkflowTemplateVariableConfigNumber: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['number'] },
      minimum: { type: 'number' },
      maximum: { type: 'number' },
      default: { type: 'number' },
    },
  },

  WorkflowTemplateVariableConfigBoolean: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['boolean'] },
      default: { type: 'boolean' },
    },
  },

  WorkflowTemplateVariableConfigChoice: {
    type: 'object',
    required: ['type', 'options'],
    properties: {
      type: { type: 'string', enum: ['choice'] },
      options: { type: 'array', items: { type: 'string' } },
      multiple: { type: 'boolean', default: false },
      forEach: { type: 'boolean', default: false },
      default: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
    },
  },

  WorkflowTemplateVariableConfigResource: {
    type: 'object',
    required: ['type', 'selector'],
    properties: {
      type: { type: 'string', enum: ['resource'] },
      selector: { type: 'string' },
      multiple: { type: 'boolean', default: false },
      forEach: { type: 'boolean', default: false },
    },
  },

  WorkflowTemplateVariableConfigEnvironment: {
    type: 'object',
    required: ['type', 'selector'],
    properties: {
      type: { type: 'string', enum: ['environment'] },
      selector: { type: 'string' },
      multiple: { type: 'boolean', default: false },
      forEach: { type: 'boolean', default: false },
    },
  },

  WorkflowTemplateVariableConfigDeployment: {
    type: 'object',
    required: ['type', 'selector'],
    properties: {
      type: { type: 'string', enum: ['deployment'] },
      selector: { type: 'string' },
      multiple: { type: 'boolean', default: false },
      forEach: { type: 'boolean', default: false },
    },
  },

  WorkflowTemplateVariableConfig: {
    oneOf: [
      openapi.schemaRef('WorkflowTemplateVariableConfigString'),
      openapi.schemaRef('WorkflowTemplateVariableConfigNumber'),
      openapi.schemaRef('WorkflowTemplateVariableConfigBoolean'),
      openapi.schemaRef('WorkflowTemplateVariableConfigChoice'),
      openapi.schemaRef('WorkflowTemplateVariableConfigResource'),
      openapi.schemaRef('WorkflowTemplateVariableConfigEnvironment'),
      openapi.schemaRef('WorkflowTemplateVariableConfigDeployment'),
    ],
  },

  // ============ WorkflowTemplate Entities ============

  WorkflowTemplateVariable: {
    type: 'object',
    required: ['id', 'templateId', 'key', 'name', 'required', 'config'],
    properties: {
      id: { type: 'string' },
      templateId: { type: 'string' },
      key: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      required: { type: 'boolean' },
      config: openapi.schemaRef('WorkflowTemplateVariableConfig'),
    },
  },

  WorkflowTemplate: {
    type: 'object',
    required: ['id', 'name', 'slug', 'systemId', 'jobAgentConfig', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      systemId: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
      },
      timeout: { type: 'integer' },
      retryCount: { type: 'integer' },
      concurrency: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
          group: { type: 'string' },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  Workflow: {
    type: 'object',
    required: ['id', 'templateId', 'triggeredBy', 'variables', 'createdAt'],
    properties: {
      id: { type: 'string' },
      templateId: { type: 'string' },
      batchId: { type: 'string', description: 'Groups workflows from same trigger (for matrix expansion)' },
      triggeredBy: { type: 'string', enum: ['manual', 'schedule', 'event'] },
      triggeredByUserId: { type: 'string' },
      triggerId: { type: 'string' },
      variables: {
        type: 'object',
        additionalProperties: true,
        description: 'Resolved variable values for this specific workflow',
      },
    },
  },
}
