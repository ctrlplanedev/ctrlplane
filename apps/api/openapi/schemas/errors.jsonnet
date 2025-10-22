{
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
}
