{
  ApprovalStatus: {
    type: 'string',
    'enum': ['approved', 'rejected'],
  },
  
  JobStatus: {
    type: 'string',
    'enum': [
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
  
  DeploymentVersionStatus: {
    type: 'string',
    'enum': ['unspecified', 'building', 'ready', 'failed', 'rejected'],
  },
  
  RelationDirection: {
    type: 'string',
    'enum': ['from', 'to'],
  },
  
  RelatableEntityType: {
    type: 'string',
    'enum': ['deployment', 'environment', 'resource'],
  },
}

