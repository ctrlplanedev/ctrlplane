{
  ApprovalStatus: {
    type: 'string',
    enum: ['approved', 'rejected'],
  },

  DeploymentVersionStatus: {
    type: 'string',
    enum: ['unspecified', 'building', 'ready', 'failed', 'rejected', 'paused'],
  },

  RelationDirection: {
    type: 'string',
    enum: ['from', 'to'],
  },

  RelatableEntityType: {
    type: 'string',
    enum: ['deployment', 'environment', 'resource'],
  },
}
