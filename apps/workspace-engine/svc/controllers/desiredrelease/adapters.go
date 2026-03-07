package desiredrelease

import (
	"time"

	"workspace-engine/pkg/oapi"
)

func buildRelease(rt *ReleaseTarget, version *oapi.DeploymentVersion, variables map[string]oapi.LiteralValue) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *version,
		Variables:          variables,
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}
