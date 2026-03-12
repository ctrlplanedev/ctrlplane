package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/http/server/openapi/resources"
	"workspace-engine/svc/http/server/openapi/validators"
)

func New() *Server {
	return &Server{}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	resources.Resources
	validators.Validator
}
