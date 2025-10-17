{
  // Parameter helpers
  stringParam(name, description):: {
    name: name,
    'in': 'path',
    required: true,
    description: description,
    schema: { type: 'string' },
  },
  
  // Common parameters
  workspaceIdParam():: self.stringParam('workspaceId', 'ID of the workspace'),
  policyIdParam():: self.stringParam('policyId', 'ID of the policy'),
  resourceIdParam():: self.stringParam('resourceId', 'ID of the resource'),
  deploymentIdParam():: self.stringParam('deploymentId', 'ID of the deployment'),
  environmentIdParam():: self.stringParam('environmentId', 'ID of the environment'),
  releaseTargetIdParam():: self.stringParam('releaseTargetId', 'ID of the release target'),
  
  entityTypeParam():: {
    name: 'entityType',
    'in': 'path',
    required: true,
    description: 'Type of the entity (deployment, environment, or resource)',
    schema: {
      type: 'string',
      'enum': ['deployment', 'environment', 'resource'],
    },
  },
  
  entityIdParam():: self.stringParam('entityId', 'ID of the entity'),
  
  // Response helpers
  schemaRef(name, nullable = false):: (
    if nullable then
      { '$ref': '#/components/schemas/' + name, nullable: true }
    else
      { '$ref': '#/components/schemas/' + name }
  ),
  
  okResponse(description, schema):: {
    '200': {
      description: description,
      content: {
        'application/json': {
          schema: schema,
        },
      },
    },
  },
  
  notFoundResponse():: {
    '404': {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { '$ref': '#/components/schemas/ErrorResponse' },
        },
      },
    },
  },
  
  badRequestResponse():: {
    '400': {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: { '$ref': '#/components/schemas/ErrorResponse' },
        },
      },
    },
  },
}
