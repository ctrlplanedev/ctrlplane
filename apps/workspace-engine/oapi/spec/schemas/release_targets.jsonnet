local openapi = import '../lib/openapi.libsonnet';

{
  ReleaseTargetItem: {
    type: 'object',
    required: ['releaseTarget', 'environment', 'resource'],
    properties: {
      releaseTarget: {
        type: 'object',
        required: ['resourceId', 'environmentId', 'deploymentId'],
        properties: {
          resourceId: { type: 'string' },
          environmentId: { type: 'string' },
          deploymentId: { type: 'string' },
        },
      },
      environment: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
      resource: {
        type: 'object',
        required: ['id', 'name', 'version', 'kind', 'identifier'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'string' },
          kind: { type: 'string' },
          identifier: { type: 'string' },
        },
      },
      desiredVersion: {
        nullable: true,
        type: 'object',
        required: ['id', 'name', 'tag'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tag: { type: 'string' },
        },
      },
      currentVersion: {
        nullable: true,
        type: 'object',
        required: ['id', 'name', 'tag'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tag: { type: 'string' },
        },
      },
      latestJob: {
        nullable: true,
        type: 'object',
        required: ['id', 'status', 'createdAt', 'metadata', 'verifications'],
        properties: {
          id: { type: 'string' },
          status: openapi.schemaRef('JobStatus'),
          message: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          metadata: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          verifications: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'jobId', 'metrics'],
              properties: {
                id: { type: 'string' },
                jobId: { type: 'string' },
                metrics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'name', 'provider', 'count', 'successCondition', 'successThreshold', 'failureCondition', 'failureThreshold'],
                    properties: {
                      id: { type: 'string' },
                      jobId: { type: 'string' },
                      policyRuleVerificationMetricId: { type: 'string' },
                      name: { type: 'string' },
                      provider: { type: 'object', additionalProperties: true },
                      count: { type: 'integer' },
                      successCondition: { type: 'string' },
                      successThreshold: { type: 'integer', nullable: true },
                      failureCondition: { type: 'string', nullable: true },
                      failureThreshold: { type: 'integer', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
