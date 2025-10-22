{
  Workspace: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Unique identifier for the workspace',
      },
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        description: 'Display name of the workspace',
      },
      slug: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-z0-9-]+$',
        description: 'URL-friendly unique identifier',
      },
      googleServiceAccountEmail: {
        type: 'string',
        format: 'email',
        nullable: true,
        description: 'Google service account email for integrations',
      },
      awsRoleArn: {
        type: 'string',
        nullable: true,
        description: 'AWS IAM role ARN for integrations',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when workspace was created',
      },
    },
    required: ['id', 'name', 'slug', 'createdAt'],
  },
  CreateWorkspaceRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        description: 'Display name of the workspace',
      },
      slug: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-z0-9-]+$',
        description: 'URL-friendly unique identifier (lowercase, no spaces)',
      },
    },
    required: ['name', 'slug'],
  },
  UpdateWorkspaceRequest: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        description: 'Display name of the workspace',
      },
      slug: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-z0-9-]+$',
        description: 'URL-friendly unique identifier (lowercase, no spaces)',
      },
    },
  },
  WorkspaceList: {
    type: 'object',
    properties: {
      workspaces: {
        type: 'array',
        items: { '$ref': '#/components/schemas/Workspace' },
      },
      total: {
        type: 'integer',
        description: 'Total number of workspaces',
      },
    },
    required: ['workspaces', 'total'],
  },
}
