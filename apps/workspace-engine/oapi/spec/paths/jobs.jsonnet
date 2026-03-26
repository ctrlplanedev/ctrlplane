local openapi = import '../lib/openapi.libsonnet';

{
  '/v1/jobs/{jobId}/verification-status': {
    get: {
      summary: 'Get aggregate verification status for a job',
      operationId: 'getJobVerificationStatus',
      parameters: [
        openapi.jobIdParam(),
      ],
      responses: openapi.okResponse({
                   type: 'object',
                   properties: {
                     status: {
                       type: 'string',
                       enum: ['passed', 'running', 'failed', ''],
                       description: 'Aggregate verification status',
                     },
                   },
                   required: ['status'],
                 }, 'Aggregate verification status for the job')
                 + openapi.badRequestResponse(),
    },
  },
}
