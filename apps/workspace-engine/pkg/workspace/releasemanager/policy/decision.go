package policy

import (
	"workspace-engine/pkg/oapi"
)

func NewDeployDecision() *oapi.DeployDecision {
	return &oapi.DeployDecision{
		PolicyResults: make([]oapi.PolicyEvaluation, 0),
	}
}
