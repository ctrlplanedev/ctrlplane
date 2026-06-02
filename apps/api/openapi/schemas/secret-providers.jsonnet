{
  SecretProviderType: {
    type: 'string',
    enum: ['aws_secrets_manager', 'doppler', 'env'],
    description: 'Type of secret provider.',
  },

  AwsSecretsManagerConfig: {
    type: 'object',
    required: ['region'],
    properties: {
      region: { type: 'string', description: 'AWS region.' },
      accessKeyId: { type: 'string', description: 'Optional static AWS access key id. Omit to use the workspace-engine instance role.' },
      secretAccessKey: { type: 'string', description: 'Optional static AWS secret access key.' },
    },
  },

  DopplerConfig: {
    type: 'object',
    required: ['serviceToken'],
    properties: {
      serviceToken: { type: 'string', description: 'Doppler service token (dp.st.<...>).' },
    },
  },

  EnvConfig: {
    type: 'object',
    required: ['allowedKeys'],
    properties: {
      allowedKeys: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Explicit allowlist of environment variable names this provider may expose.',
      },
    },
  },

  SecretProviderConfig: {
    oneOf: [
      { '$ref': '#/components/schemas/AwsSecretsManagerConfig' },
      { '$ref': '#/components/schemas/DopplerConfig' },
      { '$ref': '#/components/schemas/EnvConfig' },
    ],
    description: 'Provider-specific configuration. Shape depends on the provider type.',
  },

  UpsertSecretProviderRequest: {
    type: 'object',
    required: ['name', 'type', 'config'],
    properties: {
      name: { type: 'string', description: 'Workspace-unique name used to reference the provider from variable values.' },
      type: { '$ref': '#/components/schemas/SecretProviderType' },
      config: { '$ref': '#/components/schemas/SecretProviderConfig' },
    },
  },

  SecretProvider: {
    type: 'object',
    required: ['id', 'workspaceId', 'name', 'type', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      workspaceId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      type: { '$ref': '#/components/schemas/SecretProviderType' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    description: 'Secret provider metadata. The encrypted configuration is never returned.',
  },

  SecretProviderRequestAccepted: {
    type: 'object',
    required: ['id', 'message'],
    properties: {
      id: { type: 'string' },
      message: { type: 'string' },
    },
  },
}
