local openapi = import '../lib/openapi.libsonnet';

{
  ReleaseTargetForceDeployEvent: {
    type: 'object',
    required: ['releaseTarget', 'version'],
    properties: {
      releaseTarget: openapi.schemaRef('ReleaseTarget'),
      version: openapi.schemaRef('DeploymentVersion'),
    },
  },
}
