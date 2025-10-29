local openapi = import '../lib/openapi.libsonnet';

{
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

  GradualRolloutRule: {
    type: 'object',
    required: ['id', 'policyId', 'timeScaleInterval'],
    properties: {
      id: { type: 'string' },
      policyId: { type: 'string' },
      timeScaleInterval: { type: 'integer', format: 'int32', minimum: 0 },
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

  UserApprovalRecord: {
    type: 'object',
    required: ['userId', 'versionId', 'environmentId', 'status', 'createdAt'],
    properties: {
      userId: { type: 'string' },
      versionId: { type: 'string' },
      environmentId: { type: 'string' },
      status: openapi.schemaRef('ApprovalStatus'),
      reason: { type: 'string' },
      createdAt: { type: 'string' },
    },
  },

  DeployDecision: {
    type: 'object',
    required: ['policyResults'],
    properties: {
      policyResults: {
        type: 'array',
        items: openapi.schemaRef('PolicyEvaluation'),
      },
    },
  },

  PolicyEvaluation: {
    type: 'object',
    required: ['ruleResults'],
    properties: {
      policy: openapi.schemaRef('Policy', nullable=true),
      summary: { type: 'string' },
      ruleResults: {
        type: 'array',
        items: openapi.schemaRef('RuleEvaluation'),
      },
    },
  },

  RuleEvaluation: {
    type: 'object',
    required: ['allowed', 'actionRequired', 'message', 'details'],
    properties: {
      allowed: {
        type: 'boolean',
        description: 'Whether the rule allows the deployment',
      },
      actionRequired: {
        type: 'boolean',
        description: 'Whether the rule requires an action (e.g., approval, wait)',
      },
      actionType: {
        type: 'string',
        enum: ['approval', 'wait'],
        description: 'Type of action required',
      },
      message: {
        type: 'string',
        description: 'Human-readable explanation of the rule result',
      },
      details: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional details about the rule evaluation',
      },
    },
  },

  EvaluateReleaseTargetRequest: {
    type: 'object',
    required: ['releaseTarget', 'version'],
    properties: {
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
      version: openapi.schemaRef('DeploymentVersion'),
    },
  },
}
