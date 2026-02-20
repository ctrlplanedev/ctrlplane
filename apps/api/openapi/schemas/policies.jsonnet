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
      selector: {
        type: 'string',
        description: 'CEL expression for matching release targets. Use "true" to match all targets.',
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
    required: ['name', 'selector', 'rules', 'priority', 'enabled', 'metadata'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'integer' },
      enabled: { type: 'boolean' },
      selector: {
        type: 'string',
        description: 'CEL expression for matching release targets. Use "true" to match all targets.',
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
    required: ['id', 'name', 'createdAt', 'workspaceId', 'selector', 'rules', 'metadata', 'priority', 'enabled'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      createdAt: { type: 'string' },
      workspaceId: { type: 'string' },
      priority: { type: 'integer' },
      enabled: { type: 'boolean' },
      selector: {
        type: 'string',
        description: 'CEL expression for matching release targets. Use "true" to match all targets.',
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
      deploymentDependency: openapi.schemaRef('DeploymentDependencyRule'),
      deploymentWindow: openapi.schemaRef('DeploymentWindowRule'),
      verification: openapi.schemaRef('VerificationRule'),
      versionCooldown: openapi.schemaRef('VersionCooldownRule'),
      versionSelector: openapi.schemaRef('VersionSelectorRule'),
      retry: openapi.schemaRef('RetryRule'),
    },
  },

  VersionCooldownRule: {
    type: 'object',
    required: ['intervalSeconds'],
    properties: {
      intervalSeconds: {
        type: 'integer',
        format: 'int32',
        minimum: 0,
        description: 'Minimum time in seconds that must pass since the currently deployed (or in-progress) version was created before allowing another deployment. This enables batching of frequent upstream releases into periodic deployments.',
      },
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

  AnyApprovalRule: {
    type: 'object',
    required: ['minApprovals'],
    properties: {
      minApprovals: { type: 'integer', format: 'int32' },
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

  DeploymentDependencyRule: {
    type: 'object',
    required: ['dependsOn'],
    properties: {
      dependsOn: {
        type: 'string',
        description: 'CEL expression to match upstream deployment(s) that must have a successful release before this deployment can proceed.',
      },
    },
  },

  DeploymentWindowRule: {
    type: 'object',
    required: ['rrule', 'durationMinutes', 'allowWindow'],
    properties: {
      rrule: {
        type: 'string',
        description: 'RFC 5545 recurrence rule defining when deployment windows start (e.g., FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9)',
      },
      durationMinutes: {
        type: 'integer',
        format: 'int32',
        minimum: 1,
        description: 'Duration of each deployment window in minutes',
      },
      timezone: {
        type: 'string',
        description: 'IANA timezone for the rrule (e.g., America/New_York). Defaults to UTC if not specified',
      },
      allowWindow: {
        type: 'boolean',
        default: true,
        description: 'If true, deployments are only allowed during the window. If false, deployments are blocked during the window (deny window)',
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
}
