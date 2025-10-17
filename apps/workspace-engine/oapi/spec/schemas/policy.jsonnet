local openapi = import '../lib/openapi.libsonnet';

{
  Policy: {
    type: 'object',
    required: ['id', 'name', 'createdAt', 'workspaceId', 'selectors', 'rules'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      createdAt: { type: 'string' },
      workspaceId: { type: 'string' },
      selectors: {
        type: 'array',
        items: openapi.schemaRef('PolicyTargetSelector'),
      },
      rules: {
        type: 'array',
        items: openapi.schemaRef('PolicyRule'),
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
        'enum': ['approval', 'wait'],
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

