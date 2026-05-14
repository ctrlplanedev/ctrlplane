local openapi = import '../lib/openapi.libsonnet';

{
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
        enum: ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'regex'],
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
    enum: [true],
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

  // SecretReferenceValue identifies a secret stored in an external provider.
  // Resolution is performed at release time by the secrets resolver and the
  // returned value flows through release.Variables as a LiteralValue. The
  // plaintext is never persisted on the resolved Value.
  SecretReferenceValue: {
    type: 'object',
    required: ['secretProvider', 'secretKey'],
    properties: {
      secretProvider: {
        type: 'string',
        description: 'Workspace-unique secret_provider.name',
      },
      secretKey: {
        type: 'string',
        description: 'Secret key within the provider',
      },
      secretPath: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional provider-specific path components',
      },
      secretVersion: {
        type: 'string',
        description: 'Optional provider-specific version pin. For AWS Secrets Manager this maps to VersionId (uuid form) or VersionStage (AWSCURRENT/AWSPREVIOUS). For Doppler this maps to accept_secret_version. Empty means latest.',
      },
    },
  },

  Value: {
    oneOf: [
      openapi.schemaRef('LiteralValue'),
      openapi.schemaRef('ReferenceValue'),
      openapi.schemaRef('SensitiveValue'),
      openapi.schemaRef('SecretReferenceValue'),
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
