local openapi = import '../lib/openapi.libsonnet';

{
  JobStatus: {
    type: 'string',
    enum: [
      'cancelled',
      'skipped',
      'inProgress',
      'actionRequired',
      'pending',
      'failure',
      'invalidJobAgent',
      'invalidIntegration',
      'externalRunNotFound',
      'successful',
    ],
  },
}
