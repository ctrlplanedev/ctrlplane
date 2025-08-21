package workspace

import (
	deploymentversion "workspace-engine/pkg/engine/deployment-version"
	"workspace-engine/pkg/engine/job"
	jobagent "workspace-engine/pkg/engine/job-agent"
	epolicy "workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
)

type WorkspaceRepository struct {
	ReleaseTarget     *releasetargets.ReleaseTargetRepository
	Policy            *epolicy.PolicyRepository
	DeploymentVersion *deploymentversion.DeploymentVersionRepository
	Rule              *rules.RuleRepository
	Job               *job.JobRepository
	JobAgent          *jobagent.JobAgentRepository
}

func NewWorkspaceRepository() *WorkspaceRepository {
	return &WorkspaceRepository{
		ReleaseTarget:     releasetargets.NewReleaseTargetRepository(),
		Policy:            epolicy.NewPolicyRepository(),
		DeploymentVersion: deploymentversion.NewDeploymentVersionRepository(),
		Rule:              rules.NewRuleRepository(),
		Job:               job.NewJobRepository(),
		JobAgent:          jobagent.NewJobAgentRepository(),
	}
}
