local lib = import '../lib/openapi.libsonnet';

{
  '/v1/workspaces': {
    get: {
      summary: 'List workspaces',
      description: 'Get all workspaces accessible to the authenticated user',
      operationId: 'listWorkspaces',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      responses: {
        '200': {
          description: 'List of workspaces',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/WorkspaceList' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create workspace',
      description: 'Create a new workspace and assign creator as owner',
      operationId: 'createWorkspace',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/CreateWorkspaceRequest' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Workspace created successfully',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Workspace' },
            },
          },
        },
        '400': {
          description: 'Invalid request',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '409': {
          description: 'Workspace slug already exists',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },
  '/v1/workspaces/{workspaceId}': {
    parameters: [
      {
        name: 'workspaceId',
        'in': 'path',
        required: true,
        description: 'Workspace ID',
        schema: { type: 'string', format: 'uuid' },
      },
    ],
    get: {
      summary: 'Get workspace',
      description: 'Get a specific workspace by ID',
      operationId: 'getWorkspace',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      responses: {
        '200': {
          description: 'Workspace details',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Workspace' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '404': {
          description: 'Workspace not found',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    patch: {
      summary: 'Update workspace',
      description: 'Update workspace properties',
      operationId: 'updateWorkspace',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/UpdateWorkspaceRequest' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Workspace updated successfully',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Workspace' },
            },
          },
        },
        '400': {
          description: 'Invalid request',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '404': {
          description: 'Workspace not found',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '409': {
          description: 'Workspace slug already exists',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    delete: {
      summary: 'Delete workspace',
      description: 'Delete a workspace and all associated data',
      operationId: 'deleteWorkspace',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      responses: {
        '204': {
          description: 'Workspace deleted successfully',
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '404': {
          description: 'Workspace not found',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },
  '/v1/workspaces/slug/{workspaceSlug}': {
    parameters: [
      {
        name: 'workspaceSlug',
        'in': 'path',
        required: true,
        description: 'Workspace slug',
        schema: { type: 'string' },
      },
    ],
    get: {
      summary: 'Get workspace by slug',
      description: 'Get a specific workspace by its slug',
      operationId: 'getWorkspaceBySlug',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      responses: {
        '200': {
          description: 'Workspace details',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Workspace' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '404': {
          description: 'Workspace not found',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },
}
