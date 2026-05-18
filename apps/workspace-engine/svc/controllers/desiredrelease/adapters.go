package desiredrelease

import (
	"time"

	"workspace-engine/pkg/oapi"
)

func buildRelease(
	rt *ReleaseTarget,
	version *oapi.DeploymentVersion,
	variables map[string]oapi.LiteralValue,
	sensitiveKeys []string,
) *oapi.Release {
	if sensitiveKeys == nil {
		sensitiveKeys = []string{}
	}
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *version,
		Variables:          variables,
		EncryptedVariables: sensitiveKeys,
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}
