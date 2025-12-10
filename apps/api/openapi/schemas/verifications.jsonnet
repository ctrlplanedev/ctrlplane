local openapi = import '../lib/openapi.libsonnet';

{
  ReleaseVerification: {
    type: 'object',
    required: ['id', 'releaseId', 'metrics', 'createdAt'],
    properties: {
      id: { type: 'string' },
      releaseId: { type: 'string' },
      jobId: { type: 'string' },
      metrics: {
        type: 'array',
        items: openapi.schemaRef('VerificationMetricStatus'),
        description: 'Metrics associated with this verification',
      },
      message: {
        type: 'string',
        description: 'Summary message of verification result',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'When verification was created',
      },
    },
  },

  VerificationMetricSpec: {
    type: 'object',
    required: ['name', 'interval', 'count', 'successCondition', 'provider'],
    properties: {
      name: {
        type: 'string',
        description: 'Name of the verification metric',
      },
      interval: {
        type: 'string',
        description: 'Interval between measurements (duration string, e.g., "30s", "5m")',
        example: '30s',
      },
      count: {
        type: 'integer',
        description: 'Number of measurements to take',
        minimum: 1,
      },
      successCondition: {
        type: 'string',
        description: 'CEL expression to evaluate measurement success (e.g., "result.statusCode == 200")',
        example: 'result.statusCode == 200',
      },
      failureLimit: {
        type: 'integer',
        description: 'Stop after this many failures (0 = no limit)',
        default: 0,
      },
      provider: openapi.schemaRef('MetricProvider'),
    },
  },

  VerificationMetricStatus: {
    allOf: [
      openapi.schemaRef('VerificationMetricSpec'),
      {
        type: 'object',
        required: ['measurements'],
        properties: {
          measurements: {
            type: 'array',
            items: openapi.schemaRef('VerificationMeasurement'),
            description: 'Individual verification measurements taken for this metric',
          },
        },
      },
    ],
  },

  VerificationMeasurement: {
    type: 'object',
    required: ['passed', 'measuredAt'],
    properties: {
      passed: {
        type: 'boolean',
        description: 'Whether this measurement passed',
      },
      measuredAt: {
        type: 'string',
        format: 'date-time',
        description: 'When measurement was taken',
      },
      message: {
        type: 'string',
        description: 'Measurement result message',
      },
      data: {
        type: 'object',
        additionalProperties: true,
        description: 'Raw measurement data',
      },
    },
  },

  MetricProvider: {
    oneOf: [
      openapi.schemaRef('HTTPMetricProvider'),
    ],
    discriminator: {
      propertyName: 'type',
      mapping: {
        http: '#/components/schemas/HTTPMetricProvider',
      },
    },
  },

  HTTPMetricProvider: {
    type: 'object',
    required: ['type', 'url'],
    properties: {
      type: {
        type: 'string',
        enum: ['http'],
        description: 'Provider type',
      },
      url: {
        type: 'string',
        description: 'HTTP endpoint URL (supports Go templates)',
        example: 'http://{{ .resource.name }}.{{ .environment.name }}/health',
      },
      method: {
        type: 'string',
        description: 'HTTP method',
        default: 'GET',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      },
      headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'HTTP headers (values support Go templates)',
      },
      body: {
        type: 'string',
        description: 'Request body (supports Go templates)',
      },
      timeout: {
        type: 'string',
        description: 'Request timeout (duration string, e.g., "30s")',
        default: '30s',
      },
    },
  },

  VerificationRule: {
    type: 'object',
    required: ['metrics'],
    properties: {
      triggerOn: {
        type: 'string',
        enum: ['jobCreated', 'jobStarted', 'jobSuccess', 'jobFailure'],
        default: 'jobSuccess',
        description: 'When to trigger verification',
      },
      metrics: {
        type: 'array',
        items: openapi.schemaRef('VerificationMetricSpec'),
        minItems: 1,
        description: 'Metrics to verify',
      },
    },
  },
}
