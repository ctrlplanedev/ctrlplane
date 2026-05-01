local openapi = import '../lib/openapi.libsonnet';

{
  PlanValidationOpaRule: {
    type: 'object',
    required: ['name', 'rego'],
    properties: {
      name: {
        type: 'string',
        description: 'Human-readable rule name; used in check output to identify which rule produced a violation.',
      },
      description: { type: 'string' },
      rego: {
        type: 'string',
        description: 'Rego v1 source code. Must define a `deny` rule set following the Conftest convention (deny contains msg if { ... }).',
      },
    },
  },

  PlanValidationResult: {
    type: 'object',
    required: ['id', 'resultId', 'ruleId', 'passed', 'violations', 'evaluatedAt'],
    properties: {
      id: { type: 'string' },
      resultId: {
        type: 'string',
        description: 'ID of the deployment_plan_target_result this validation was run against.',
      },
      ruleId: {
        type: 'string',
        description: 'Polymorphic rule id. Resolves to a specific rule type (e.g. PlanValidationOpaRule) known by the writing controller.',
      },
      passed: { type: 'boolean' },
      violations: {
        type: 'array',
        items: openapi.schemaRef('PlanValidationViolation'),
      },
      evaluatedAt: { type: 'string', format: 'date-time' },
    },
  },

  PlanValidationViolation: {
    type: 'object',
    required: ['message'],
    properties: {
      message: { type: 'string' },
    },
  },
}
