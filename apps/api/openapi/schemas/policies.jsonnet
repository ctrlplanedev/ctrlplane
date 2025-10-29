local openapi = import '../lib/openapi.libsonnet';

{
  CreatePolicyRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'integer' },
      enabled: { type: 'boolean' },
      selectors: {
        type: 'array',
        items: openapi.schemaRef('PolicyTargetSelector'),
      },
      rules: {
        type: 'array',
        items: openapi.schemaRef('PolicyRule'),
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Arbitrary metadata for the policy (record<string, string>)',
      },
    },
  },

  UpsertPolicyRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'integer' },
      enabled: { type: 'boolean' },
      selectors: {
        type: 'array',
        items: openapi.schemaRef('PolicyTargetSelector'),
      },
      rules: {
        type: 'array',
        items: openapi.schemaRef('PolicyRule'),
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Arbitrary metadata for the policy (record<string, string>)',
      },
    },
  },

  Policy: {
    type: 'object',
    required: ['id', 'name', 'createdAt', 'workspaceId', 'selectors', 'rules', 'metadata', 'priority', 'enabled'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      createdAt: { type: 'string' },
      workspaceId: { type: 'string' },
      priority: { type: 'integer' },
      enabled: { type: 'boolean' },
      selectors: {
        type: 'array',
        items: openapi.schemaRef('PolicyTargetSelector'),
      },
      rules: {
        type: 'array',
        items: openapi.schemaRef('PolicyRule'),
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Arbitrary metadata for the policy (record<string, string>)',
      },
    },
  },

  PolicyTargetSelector: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
      deploymentSelector: openapi.schemaRef('Selector'),
      environmentSelector: openapi.schemaRef('Selector'),
      resourceSelector: openapi.schemaRef('Selector'),
    },
  },

  PolicyRule: {
    type: 'object',
    required: ['id', 'policyId', 'createdAt'],
    properties: {
      id: { type: 'string' },
      policyId: { type: 'string' },
      createdAt: { type: 'string' },
      anyApproval: openapi.schemaRef('AnyApprovalRule'),
      environmentProgression: openapi.schemaRef('EnvironmentProgressionRule'),
      gradualRollout: openapi.schemaRef('GradualRolloutRule'),
    },
  },

  EnvironmentProgressionRule: {
    type: 'object',
    required: ['id', 'policyId', 'dependsOnEnvironmentSelector'],
    properties: {
      id: { type: 'string' },
      policyId: { type: 'string' },
      dependsOnEnvironmentSelector: openapi.schemaRef('Selector'),

      minimumSuccessPercentage: { type: 'number', format: 'float', minimum: 0, maximum: 100, default: 100 },
      successStatuses: { type: 'array', items: openapi.schemaRef('JobStatus') },

      minimumSockTimeMinutes: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        default: 0,
        description: 'Minimum time to wait after the depends on environment is in a success state before the current environment can be deployed',
      },

      maximumAgeHours: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        description: 'Maximum age of dependency deployment before blocking progression (prevents stale promotions)',
      },
    },
  },

  AnyApprovalRule: {
    type: 'object',
    required: ['minApprovals'],
    properties: {
      minApprovals: { type: 'integer', format: 'int32' },
    },
  },

  GradualRolloutRule: {
    type: 'object',
    required: ['id', 'policyId', 'timeScaleInterval'],
    properties: {
      id: { type: 'string' },
      policyId: { type: 'string' },
      timeScaleInterval: { type: 'integer', format: 'int32', minimum: 0 },
    },
  },
}
