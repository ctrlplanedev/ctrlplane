package openapi

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/http/server/openapi/deployments"
	release_targets "workspace-engine/svc/http/server/openapi/release_targets"
	"workspace-engine/svc/http/server/openapi/resources"
	"workspace-engine/svc/http/server/openapi/validators"
	"workspace-engine/svc/http/server/openapi/verifications"
	"workspace-engine/svc/http/server/openapi/workflows"
)

func New(pool *pgxpool.Pool) *Server {
	return &Server{
		Deployments:    deployments.New(),
		Workflows:      workflows.NewWorkflows(pool),
		ReleaseTargets: release_targets.New(),
		Verifications:  verifications.New(),
	}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	deployments.Deployments
	resources.Resources
	validators.Validator
	workflows.Workflows
	release_targets.ReleaseTargets
	verifications.Verifications
}
