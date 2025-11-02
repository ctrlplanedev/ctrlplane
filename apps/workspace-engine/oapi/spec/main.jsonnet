{
  openapi: '3.0.0',
  info: {
    title: 'Workspace Engine API',
    version: '1.0.0',
    description: 'OpenAPI schemas for workspace engine protobuf messages',
  },

  // Combine all path modules
  paths:
    (import 'paths/workspace.jsonnet') +
    (import 'paths/resource.jsonnet') +
    (import 'paths/policy.jsonnet') +
    (import 'paths/release-target.jsonnet') +
    (import 'paths/relationship.jsonnet') +
    (import 'paths/deployment.jsonnet') +
    (import 'paths/deployment-version.jsonnet') +
    (import 'paths/environment.jsonnet') +
    (import 'paths/system.jsonnet') +
    (import 'paths/job-agents.jsonnet') +
    (import 'paths/jobs.jsonnet') +
    (import 'paths/validate.jsonnet') +
    (import 'paths/resource-providers.jsonnet') +
    (import 'paths/github-entity.jsonnet') +
    (import 'paths/relationship-rules.jsonnet'),

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
      (import 'schemas/deployments.jsonnet'),
  },
}
