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

  ResolvedPolicy: {
    type: 'object',
    required: ['policy', 'environmentIds', 'releaseTargets'],
    properties: {
      policy: openapi.schemaRef('Policy'),
      environmentIds: { type: 'array', items: { type: 'string' } },
      releaseTargets: { type: 'array', items: openapi.schemaRef('ReleaseTarget') },
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
      retry: openapi.schemaRef('RetryRule'),
      versionSelector: openapi.schemaRef('VersionSelectorRule'),
      deploymentDependency: openapi.schemaRef('DeploymentDependencyRule'),
    },
  },

  VersionSelectorRule: {
    type: 'object',
    required: ['selector'],
    properties: {
      selector: openapi.schemaRef('Selector'),
      description: {
        type: 'string',
        description: 'Human-readable description of what this version selector does. Example: "Only deploy v2.x versions to staging environments"',
      },
    },
  },

  RetryRule: {
    type: 'object',
    required: ['maxRetries'],
    properties: {
      maxRetries: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        description: 'Maximum number of retries allowed. 0 means no retries (1 attempt total), 3 means up to 4 attempts (1 initial + 3 retries).',
      },
      retryOnStatuses: {
        type: 'array',
        items: openapi.schemaRef('JobStatus'),
        description: 'Job statuses that count toward the retry limit. If null or empty, defaults to ["failure", "invalidIntegration", "invalidJobAgent"] for maxRetries > 0, or ["failure", "invalidIntegration", "invalidJobAgent", "successful"] for maxRetries = 0. Cancelled and skipped jobs never count by default (allows redeployment after cancellation). Example: ["failure", "cancelled"] will only count failed/cancelled jobs.',
      },
      backoffSeconds: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        description: 'Minimum seconds to wait between retry attempts. If null, retries are allowed immediately after job completion.',
      },
      backoffStrategy: {
        type: 'string',
        enum: ['linear', 'exponential'],
        default: 'linear',
        description: 'Backoff strategy: "linear" uses constant backoffSeconds delay, "exponential" doubles the delay with each retry (backoffSeconds * 2^(attempt-1)).',
      },
      maxBackoffSeconds: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        description: 'Maximum backoff time in seconds (cap for exponential backoff). If null, no maximum is enforced.',
      },
    },
  },

  GradualRolloutRule: {
    type: 'object',
    required: ['timeScaleInterval', 'rolloutType'],
    properties: {
      timeScaleInterval: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        description: 'Base time interval in seconds used to compute the delay between deployments to release targets.',
      },
      rolloutType: {
        type: 'string',
        enum: ['linear', 'linear-normalized'],
        description: 'Strategy for scheduling deployments to release targets. ' +
                     '"linear": Each target is deployed at a fixed interval of timeScaleInterval seconds. ' +
                     '"linear-normalized": Deployments are spaced evenly so that the last target is scheduled at or before timeScaleInterval seconds. ' +
                     'See rolloutType algorithm documentation for details.',
      },
    },
  },

  EnvironmentProgressionRule: {
    type: 'object',
    required: ['dependsOnEnvironmentSelector'],
    properties: {
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

  DeploymentDependencyRule: {
    type: 'object',
    required: ['dependsOnDeploymentSelector'],
    properties: {
      dependsOnDeploymentSelector: openapi.schemaRef('Selector'),
      reference: {
        type: 'string',
        description: 'Reference to the entity that this rule depends on',
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
    required: ['ruleId', 'allowed', 'actionRequired', 'message', 'details'],
    properties: {
      ruleId: {
        type: 'string',
        description: 'The ID of the rule that was evaluated',
      },
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
      satisfiedAt: {
        type: 'string',
        format: 'date-time',
        description: 'The time when the rule requirement was satisfied (e.g., when approvals were met, soak time completed)',
      },
      nextEvaluationTime: {
        type: 'string',
        format: 'date-time',
        description: 'The time when this rule should be re-evaluated (e.g., when soak time will be complete, when gradual rollout schedule is due)',
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

  EvaluationScope: {
    type: 'object',
    properties: {
      environmentId: { type: 'string' },
      versionId: { type: 'string' },
    },
  },

  PolicyBypass: {
    type: 'object',
    required: ['id', 'workspaceId', 'versionId', 'bypassRuleTypes', 'justification', 'createdBy', 'createdAt'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for the bypass',
      },
      workspaceId: {
        type: 'string',
        description: 'Workspace this bypass belongs to',
      },
      versionId: {
        type: 'string',
        description: 'Deployment version this bypass applies to',
      },
      environmentId: {
        type: 'string',
        description: 'Environment this bypass applies to. If null, applies to all environments.',
      },
      resourceId: {
        type: 'string',
        description: 'Resource this bypass applies to. If null, applies to all resources (in the environment if specified, or globally).',
      },
      policyIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Policy IDs this bypass applies to. If empty, applies to all policies.',
      },

      // Which policy rule types to bypass
      bypassRuleTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['approval', 'environmentProgression', 'gradualRollout', 'retry'],
        },
        description: 'Which policy rule types to bypass.',
      },

      // Audit fields
      justification: {
        type: 'string',
        description: 'Required explanation for why this bypass is needed (e.g., incident ticket, emergency situation)',
      },
      createdBy: {
        type: 'string',
        description: 'User ID who created this bypass',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'When this bypass was created',
      },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        description: 'When this bypass expires. If null, bypass never expires.',
      },
    },
  },
}
