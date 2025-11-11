local openapi = import '../lib/openapi.libsonnet';

{
  CreateJobAgentRequest: {
    type: 'object',
    required: ['name', 'type', 'config'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
    },
  },
  UpdateJobAgentRequest: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
    },
  },
  JobAgent: {
    type: 'object',
    required: ['id', 'name', 'type', 'config'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
    },
  },
}