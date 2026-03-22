{
  openapi: '3.0.0',
  info: {
    title: 'Workspace Engine API',
    version: '1.0.0',
    description: 'OpenAPI schemas for workspace engine protobuf messages',
  },

  // Combine all path modules
  paths:
    (import 'paths/resource.jsonnet') +
    (import 'paths/validate.jsonnet') +
    (import 'paths/workflows.jsonnet'),

  components: {
    parameters: (import 'parameters/core.jsonnet'),
    // Combine all schema modules
    schemas:
      (import 'schemas/enums.jsonnet') +
      (import 'schemas/core.jsonnet') +
      (import 'schemas/entities.jsonnet') +
      (import 'schemas/policy.jsonnet') +
      (import 'schemas/relationship.jsonnet') +
      (import 'schemas/jobs.jsonnet') +
      (import 'schemas/deployments.jsonnet') +
      (import 'schemas/environments.jsonnet') +
      (import 'schemas/verification.jsonnet') +
      (import 'schemas/resourcevariables.jsonnet') +
      (import 'schemas/systems.jsonnet') +
      (import 'schemas/workflows.jsonnet'),
  },
}
