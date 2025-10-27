local openapi = import '../lib/openapi.libsonnet';

{
  UpsertUserApprovalRecordRequest: {
    type: 'object',
    required: ['status'],
    properties: {
      environmentIds: { type: 'array', items: { type: 'string' } },
      status: openapi.schemaRef('ApprovalStatus'),
      reason: { type: 'string' },
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
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  ApprovalStatus: {
    type: 'string',
    enum: ['approved', 'rejected'],
  },
}