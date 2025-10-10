package repository

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
)

func New() *Repository {
	return &Repository{
		Resources:           cmap.New[*oapi.Resource](),
		ResourceProviders:   cmap.New[*oapi.ResourceProvider](),
		ResourceVariables:   cmap.New[*oapi.ResourceVariable](),
		Deployments:         cmap.New[*oapi.Deployment](),
		DeploymentVersions:  cmap.New[*oapi.DeploymentVersion](),
		DeploymentVariables: cmap.New[*oapi.DeploymentVariable](),
		Environments:        cmap.New[*oapi.Environment](),
		Policies:            cmap.New[*oapi.Policy](),
		Systems:             cmap.New[*oapi.System](),
		Releases:            cmap.New[*oapi.Release](),
		Jobs:                cmap.New[*oapi.Job](),
		JobAgents:           cmap.New[*oapi.JobAgent](),
		UserApprovalRecords: cmap.New[*oapi.UserApprovalRecord](),
		RelationshipRules:   cmap.New[*oapi.RelationshipRule](),
	}
}

type Repository struct {
	Resources         cmap.ConcurrentMap[string, *oapi.Resource]
	ResourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	ResourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	Deployments         cmap.ConcurrentMap[string, *oapi.Deployment]
	DeploymentVariables cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	DeploymentVersions  cmap.ConcurrentMap[string, *oapi.DeploymentVersion]

	Environments cmap.ConcurrentMap[string, *oapi.Environment]
	Policies     cmap.ConcurrentMap[string, *oapi.Policy]
	Systems      cmap.ConcurrentMap[string, *oapi.System]
	Releases     cmap.ConcurrentMap[string, *oapi.Release]

	Jobs      cmap.ConcurrentMap[string, *oapi.Job]
	JobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	UserApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]
}
