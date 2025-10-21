{
  openapi: '3.0.0',
  info: {
    title: 'Ctrlplane API',
    version: '1.0.0',
    description: 'OpenAPI schemas for Ctrlplane API',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server',
    },
  ],
  paths: {
    '/v1/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        description: 'Retrieve a list of all users',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            'in': 'query',
            description: 'Maximum number of users to return',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
          {
            name: 'offset',
            'in': 'query',
            description: 'Number of users to skip',
            required: false,
            schema: {
              type: 'integer',
              minimum: 0,
              default: 0,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { '$ref': '#/components/schemas/User' },
                    },
                    total: {
                      type: 'integer',
                      description: 'Total number of users',
                    },
                  },
                  required: ['data', 'total'],
                },
              },
            },
          },
          '401': { '$ref': '#/components/responses/UnauthorizedError' },
          '500': { '$ref': '#/components/responses/InternalServerError' },
        },
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a new user',
        description: 'Create a new user with the provided data',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/CreateUserRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/User' },
              },
            },
          },
          '400': { '$ref': '#/components/responses/BadRequestError' },
          '401': { '$ref': '#/components/responses/UnauthorizedError' },
          '500': { '$ref': '#/components/responses/InternalServerError' },
        },
      },
    },
    '/v1/users/{userId}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user by ID',
        description: 'Retrieve a specific user by their ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            'in': 'path',
            description: 'User ID',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/User' },
              },
            },
          },
          '401': { '$ref': '#/components/responses/UnauthorizedError' },
          '404': { '$ref': '#/components/responses/NotFoundError' },
          '500': { '$ref': '#/components/responses/InternalServerError' },
        },
      },
      patch: {
        operationId: 'updateUser',
        summary: 'Update user',
        description: 'Update a specific user by their ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            'in': 'path',
            description: 'User ID',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/UpdateUserRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'User updated successfully',
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/User' },
              },
            },
          },
          '400': { '$ref': '#/components/responses/BadRequestError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '404': { '$ref': '#/components/responses/NotFoundError' },
          '500': { $ref: '#/components/responses/InternalServerError' },
        },
      },
      delete: {
        operationId: 'deleteUser',
        summary: 'Delete user',
        description: 'Delete a specific user by their ID',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            'in': 'path',
            description: 'User ID',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '204': {
            description: 'User deleted successfully',
          },
          '401': { '$ref': '#/components/responses/UnauthorizedError' },
          '404': { '$ref': '#/components/responses/NotFoundError' },
          '500': { '$ref': '#/components/responses/InternalServerError' },
        },
      },
    },
  },
  components: {
    parameters: {},
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address of the user',
          },
          name: {
            type: 'string',
            description: 'Full name of the user',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the user was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the user was last updated',
          },
        },
        required: ['id', 'email', 'name', 'createdAt', 'updatedAt'],
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address of the user',
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Full name of the user',
          },
        },
        required: ['email', 'name'],
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address of the user',
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Full name of the user',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Error message',
          },
          code: {
            type: 'string',
            description: 'Error code',
          },
          details: {
            type: 'object',
            description: 'Additional error details',
          },
        },
        required: ['message'],
      },
    },
    responses: {
      BadRequestError: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
      UnauthorizedError: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
    },
  },
}
