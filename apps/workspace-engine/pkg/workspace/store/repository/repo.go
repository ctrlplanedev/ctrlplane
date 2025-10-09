package repository

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
)

func New() *Repository {
	return &Repository{
		Resources:           cmap.New[*pb.Resource](),
		Deployments:         cmap.New[*pb.Deployment](),
		DeploymentVersions:  cmap.New[*pb.DeploymentVersion](),
		DeploymentVariables: cmap.New[*pb.DeploymentVariable](),
		Environments:        cmap.New[*pb.Environment](),
		Policies:            cmap.New[*pb.Policy](),
		Systems:             cmap.New[*pb.System](),
		Releases:            cmap.New[*pb.Release](),
		Jobs:                cmap.New[*pb.Job](),
		JobAgents:           cmap.New[*pb.JobAgent](),
		UserApprovalRecords: cmap.New[*pb.UserApprovalRecord](),
		RelationshipRules:   cmap.New[*pb.RelationshipRule](),
	}
}

type Repository struct {
	Resources           cmap.ConcurrentMap[string, *pb.Resource]
	Deployments         cmap.ConcurrentMap[string, *pb.Deployment]
	DeploymentVariables cmap.ConcurrentMap[string, *pb.DeploymentVariable]
	DeploymentVersions  cmap.ConcurrentMap[string, *pb.DeploymentVersion]
	Environments        cmap.ConcurrentMap[string, *pb.Environment]
	Policies            cmap.ConcurrentMap[string, *pb.Policy]
	Systems             cmap.ConcurrentMap[string, *pb.System]
	Releases            cmap.ConcurrentMap[string, *pb.Release]
	Jobs                cmap.ConcurrentMap[string, *pb.Job]
	JobAgents           cmap.ConcurrentMap[string, *pb.JobAgent]

	UserApprovalRecords cmap.ConcurrentMap[string, *pb.UserApprovalRecord]
	RelationshipRules       cmap.ConcurrentMap[string, *pb.RelationshipRule]
}
