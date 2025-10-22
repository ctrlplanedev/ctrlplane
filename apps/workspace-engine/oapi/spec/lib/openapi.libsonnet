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
  resourceIdentifierParam():: self.stringParam('resourceIdentifier', 'Identifier of the resource'),
  deploymentIdParam():: self.stringParam('deploymentId', 'ID of the deployment'),
  environmentIdParam():: self.stringParam('environmentId', 'ID of the environment'),
  systemIdParam():: self.stringParam('systemId', 'ID of the system'),
  releaseTargetKeyParam():: self.stringParam('releaseTargetKey', 'Key of the release target'),
  jobAgentIdParam():: self.stringParam('jobAgentId', 'ID of the job agent'),
  jobIdParam():: self.stringParam('jobId', 'ID of the job'),
  
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
  
  // Pagination parameters
  limitParam(defaultValue = 50):: {
    name: 'limit',
    'in': 'query',
    required: false,
    description: 'Maximum number of items to return',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      default: defaultValue,
    },
  },
  
  offsetParam():: {
    name: 'offset',
    'in': 'query',
    required: false,
    description: 'Number of items to skip',
    schema: {
      type: 'integer',
      minimum: 0,
      default: 0,
    },
  },

  celParam():: {
    name: 'cel',
    'in': 'query',
    required: false,
    description: 'CEL expression to filter the results',
    schema: {
      type: 'string',
    },
  },
  
  // Response helpers
  schemaRef(name, nullable = false):: (
    if nullable then
      { '$ref': '#/components/schemas/' + name, nullable: true }
    else
      { '$ref': '#/components/schemas/' + name }
  ),
  
  okResponse(schema, description = "OK response"):: {
    '200': {
      description: description,
      content: {
        'application/json': {
          schema: schema,
        },
      },
    },
  },
  
  paginatedResponse(itemsSchema, description = "Paginated list of items"):: {
    '200': {
      description: description,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: itemsSchema,
              },
              total: {
                type: 'integer',
                description: 'Total number of items available',
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of items returned',
              },
              offset: {
                type: 'integer',
                description: 'Number of items skipped',
              },
            },
            required: ['items', 'total', 'limit', 'offset'],
          },
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
