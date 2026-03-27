package openapi

import (
	"workspace-engine/pkg/oapi"
	release_targets "workspace-engine/svc/http/server/openapi/release_targets"
	"workspace-engine/svc/http/server/openapi/resources"
	"workspace-engine/svc/http/server/openapi/validators"
	"workspace-engine/svc/http/server/openapi/verifications"
	"workspace-engine/svc/http/server/openapi/workflows"
)

func New() *Server {
	return &Server{
		Workflows:      workflows.NewWorkflows(),
		ReleaseTargets: release_targets.New(),
		Verifications:  verifications.New(),
	}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	resources.Resources
	validators.Validator
	workflows.Workflows
	release_targets.ReleaseTargets
	verifications.Verifications
}
