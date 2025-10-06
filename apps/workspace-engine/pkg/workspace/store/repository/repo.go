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
	UserApprovalRecords []*pb.UserApprovalRecord
}

func loadResources(initialResources []*pb.Resource) cmap.ConcurrentMap[string, *pb.Resource] {
	resources := cmap.New[*pb.Resource]()
	for _, resource := range initialResources {
		resources.Set(resource.GetId(), resource)
	}
	return resources
}

func loadDeployments(initialDeployments []*pb.Deployment) cmap.ConcurrentMap[string, *pb.Deployment] {

	deployments := cmap.New[*pb.Deployment]()
	for _, deployment := range initialDeployments {
		deployments.Set(deployment.GetId(), deployment)
	}
	return deployments
}

func loadDeploymentVersions(initialDeploymentVersions []*pb.DeploymentVersion) cmap.ConcurrentMap[string, *pb.DeploymentVersion] {

	deploymentVersions := cmap.New[*pb.DeploymentVersion]()
	for _, deploymentVersion := range initialDeploymentVersions {
		deploymentVersions.Set(deploymentVersion.GetId(), deploymentVersion)
	}
	return deploymentVersions
}

func loadDeploymentVariables(initialDeploymentVariables []*pb.DeploymentVariable) cmap.ConcurrentMap[string, *pb.DeploymentVariable] {

	deploymentVariables := cmap.New[*pb.DeploymentVariable]()
	for _, deploymentVariable := range initialDeploymentVariables {
		deploymentVariables.Set(deploymentVariable.GetId(), deploymentVariable)
	}
	return deploymentVariables
}

func loadEnvironments(initialEnvironments []*pb.Environment) cmap.ConcurrentMap[string, *pb.Environment] {

	environments := cmap.New[*pb.Environment]()
	for _, environment := range initialEnvironments {
		environments.Set(environment.GetId(), environment)
	}
	return environments
}

func loadPolicies(initialPolicies []*pb.Policy) cmap.ConcurrentMap[string, *pb.Policy] {

	policies := cmap.New[*pb.Policy]()
	for _, policy := range initialPolicies {
		policies.Set(policy.GetId(), policy)
	}
	return policies
}

func loadSystems(initialSystems []*pb.System) cmap.ConcurrentMap[string, *pb.System] {
	systems := cmap.New[*pb.System]()
	for _, system := range initialSystems {
		systems.Set(system.GetId(), system)
	}
	return systems
}

func loadReleases(initialReleases []*pb.Release) cmap.ConcurrentMap[string, *pb.Release] {
	releases := cmap.New[*pb.Release]()
	for _, release := range initialReleases {
		releases.Set(release.ID(), release)
	}
	return releases
}

func loadJobs(initialJobs []*pb.Job) cmap.ConcurrentMap[string, *pb.Job] {
	jobs := cmap.New[*pb.Job]()
	for _, job := range initialJobs {
		jobs.Set(job.GetId(), job)
	}
	return jobs
}

func loadJobAgents(initialJobAgents []*pb.JobAgent) cmap.ConcurrentMap[string, *pb.JobAgent] {
	jobAgents := cmap.New[*pb.JobAgent]()
	for _, jobAgent := range initialJobAgents {
		jobAgents.Set(jobAgent.GetId(), jobAgent)
	}
	return jobAgents
}

func loadUserApprovalRecords(initialUserApprovalRecords []*pb.UserApprovalRecord) cmap.ConcurrentMap[string, *pb.UserApprovalRecord] {
	userApprovalRecords := cmap.New[*pb.UserApprovalRecord]()
	for _, userApprovalRecord := range initialUserApprovalRecords {
		userApprovalRecords.Set(userApprovalRecord.Key(), userApprovalRecord)
	}
	return userApprovalRecords
}

func Load(initialEntities *InitialEntities) *Repository {
	return &Repository{
		Resources:           loadResources(initialEntities.Resources),
		Deployments:         loadDeployments(initialEntities.Deployments),
		DeploymentVersions:  loadDeploymentVersions(initialEntities.DeploymentVersions),
		DeploymentVariables: loadDeploymentVariables(initialEntities.DeploymentVariables),
		Environments:        loadEnvironments(initialEntities.Environments),
		Policies:            loadPolicies(initialEntities.Policies),
		Systems:             loadSystems(initialEntities.Systems),
		Releases:            loadReleases(initialEntities.Releases),
		Jobs:                loadJobs(initialEntities.Jobs),
		JobAgents:           loadJobAgents(initialEntities.JobAgents),
		UserApprovalRecords: loadUserApprovalRecords(initialEntities.UserApprovalRecords),
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
