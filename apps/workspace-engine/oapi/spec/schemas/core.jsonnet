local openapi = import '../lib/openapi.libsonnet';

{
  // Selector types
  JsonSelector: {
    type: 'object',
    required: ['json'],
    properties: {
      json: { type: 'object' },
    },
  },
  
  CelSelector: {
    type: 'object',
    required: ['cel'],
    properties: {
      cel: { type: 'string' },
    },
  },
  
  Selector: {
    oneOf: [
      openapi.schemaRef('JsonSelector'),
      openapi.schemaRef('CelSelector'),
    ],
  },
  
  // Property matcher
  PropertyMatcher: {
    type: 'object',
    required: ['fromProperty', 'toProperty', 'operator'],
    properties: {
      fromProperty: {
        type: 'array',
        items: { type: 'string' },
      },
      toProperty: {
        type: 'array',
        items: { type: 'string' },
      },
      operator: {
        type: 'string',
        'enum': ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'regex'],
      },
    },
  },
  
  // Value types
  BooleanValue: { type: 'boolean' },
  NumberValue: { type: 'number' },
  IntegerValue: { type: 'integer' },
  StringValue: { type: 'string' },
  
  ObjectValue: {
    type: 'object',
    required: ['object'],
    properties: {
      object: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
  
  NullValue: {
    type: 'boolean',
    'enum': [true],
  },
  
  LiteralValue: {
    oneOf: [
      openapi.schemaRef('BooleanValue'),
      openapi.schemaRef('NumberValue'),
      openapi.schemaRef('IntegerValue'),
      openapi.schemaRef('StringValue'),
      openapi.schemaRef('ObjectValue'),
      openapi.schemaRef('NullValue'),
    ],
  },
  
  SensitiveValue: {
    type: 'object',
    required: ['valueHash'],
    properties: {
      valueHash: { type: 'string' },
    },
  },
  
  ReferenceValue: {
    type: 'object',
    required: ['reference', 'path'],
    properties: {
      reference: { type: 'string' },
      path: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  
  Value: {
    oneOf: [
      openapi.schemaRef('LiteralValue'),
      openapi.schemaRef('ReferenceValue'),
      openapi.schemaRef('SensitiveValue'),
    ],
  },
  
  // Error schemas
  ErrorResponse: {
    type: 'object',
    properties: {
      'error': {
        type: 'string',
        example: 'Workspace not found',
      },
    },
  },
}

