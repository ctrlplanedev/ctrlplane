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
    required: ['name', 'intervalSeconds', 'count', 'provider', 'successCondition'],
    properties: {
      name: {
        type: 'string',
        description: 'Name of the verification metric',
      },
      intervalSeconds: {
        type: 'integer',
        format: 'int32',
        minimum: 1,
        description: 'Interval between measurements in seconds',
        example: 30,
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
      failureCondition: {
        type: 'string',
        description: 'CEL expression to evaluate measurement failure (e.g., "result.statusCode == 500"), if not provided, a failure is just the opposite of the success condition',
        example: 'result.statusCode == 500',
      },
      failureThreshold: {
        type: 'integer',
        description: 'Stop after this many consecutive failures (0 = no limit)',
        default: 0,
      },
      successThreshold: {
        type: 'integer',
        description: 'Minimum number of consecutive successful measurements required to consider the metric successful',
        example: 0,
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

  VerificationMeasurementStatus: {
    type: 'string',
    enum: ['passed', 'failed', 'inconclusive'],
    description: 'Status of a verification measurement',
  },

  VerificationMeasurement: {
    type: 'object',
    required: ['status', 'measuredAt'],
    properties: {
      status: openapi.schemaRef('VerificationMeasurementStatus'),
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
      openapi.schemaRef('SleepMetricProvider'),
      openapi.schemaRef('DatadogMetricProvider'),
      openapi.schemaRef('TerraformCloudRunMetricProvider'),
    ],
    discriminator: {
      propertyName: 'type',
      mapping: {
        http: '#/components/schemas/HTTPMetricProvider',
        sleep: '#/components/schemas/SleepMetricProvider',
        datadog: '#/components/schemas/DatadogMetricProvider',
        terraformCloudRun: '#/components/schemas/TerraformCloudRunMetricProvider',
      },
    },
  },

  SleepMetricProvider: {
    type: 'object',
    required: ['type', 'durationSeconds'],
    properties: {
      type: {
        type: 'string',
        enum: ['sleep'],
        description: 'Provider type',
      },
      durationSeconds: {
        type: 'integer',
        format: 'int32',
        example: 30,
        minimum: 1,
        maximum: 3600,
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

  DatadogMetricProvider: {
    type: 'object',
    required: ['type', 'query', 'apiKey', 'appKey'],
    properties: {
      type: {
        type: 'string',
        enum: ['datadog'],
        description: 'Provider type',
      },
      query: {
        type: 'string',
        description: 'Datadog metrics query (supports Go templates)',
        example: 'sum:requests.error.rate{service:{{.resource.name}}}',
      },
      apiKey: {
        type: 'string',
        description: 'Datadog API key (supports Go templates for variable references)',
        example: '{{.variables.dd_api_key}}',
      },
      appKey: {
        type: 'string',
        description: 'Datadog Application key (supports Go templates for variable references)',
        example: '{{.variables.dd_app_key}}',
      },
      site: {
        type: 'string',
        description: 'Datadog site URL (e.g., datadoghq.com, datadoghq.eu, us3.datadoghq.com)',
        default: 'datadoghq.com',
      },
    },
  },

  TerraformCloudRunMetricProvider: {
    type: 'object',
    required: ['type', 'organization', 'address', 'token', 'runId'],
    properties: {
      type: {
        type: 'string',
        enum: ['terraformCloudRun'],
        description: 'Provider type',
      },
      address: {
        type: 'string',
        description: 'Terraform Cloud address',
        example: 'https://app.terraform.io',
      },
      token: {
        type: 'string',
        description: 'Terraform Cloud token',
        example: '{{.variables.terraform_cloud_token}}',
      },
      runId: {
        type: 'string',
        description: 'Terraform Cloud run ID',
        example: 'run-1234567890',
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
