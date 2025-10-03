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
}
