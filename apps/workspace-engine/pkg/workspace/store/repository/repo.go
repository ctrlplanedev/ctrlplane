package repository

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
)

type InitialEntities struct {
	Resources           []*pb.Resource
	Deployments         []*pb.Deployment
	DeploymentVersions  []*pb.DeploymentVersion
	DeploymentVariables []*pb.DeploymentVariable
	Environments        []*pb.Environment
	Policies            []*pb.Policy
	Systems             []*pb.System
	Releases            []*pb.Release
	Jobs                []*pb.Job
	JobAgents           []*pb.JobAgent
}

func Load(initialEntities *InitialEntities) *Repository {
	return &Repository{
		Resources:           cmap.LoadString(initialEntities.Resources, func(r *pb.Resource) string { return r.GetId() }),
		Deployments:         cmap.LoadString(initialEntities.Deployments, func(d *pb.Deployment) string { return d.GetId() }),
		DeploymentVersions:  cmap.LoadString(initialEntities.DeploymentVersions, func(dv *pb.DeploymentVersion) string { return dv.GetId() }),
		DeploymentVariables: cmap.LoadString(initialEntities.DeploymentVariables, func(dv *pb.DeploymentVariable) string { return dv.GetId() }),
		Environments:        cmap.LoadString(initialEntities.Environments, func(e *pb.Environment) string { return e.GetId() }),
		Policies:            cmap.LoadString(initialEntities.Policies, func(p *pb.Policy) string { return p.GetId() }),
		Systems:             cmap.LoadString(initialEntities.Systems, func(s *pb.System) string { return s.GetId() }),
		Releases:            cmap.LoadString(initialEntities.Releases, func(r *pb.Release) string { return r.ID() }),
		Jobs:                cmap.LoadString(initialEntities.Jobs, func(j *pb.Job) string { return j.GetId() }),
		JobAgents:           cmap.LoadString(initialEntities.JobAgents, func(ja *pb.JobAgent) string { return ja.GetId() }),
	}
}

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
}
