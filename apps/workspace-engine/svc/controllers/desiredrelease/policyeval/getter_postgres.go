package policyeval

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/planvalidation"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

var _ Getter = (*PostgresGetter)(nil)

// PostgresGetter satisfies the composite Getter interface by embedding
// *gradualrollout.PostgresGetters (which transitively promotes methods from
// approval, environmentprogression, deploymentwindow, and all store getters)
// and forwarding only the methods unique to versioncooldown and
// deploymentdependency.
type PostgresGetter struct {
	gradualrolloutGetter
	versioncooldown      *versioncooldown.PostgresGetters
	deploymentdependency *deploymentdependency.PostgresGetters
}

func NewPostgresGetter(
	queries *db.Queries,
	rtForDep releasetargets.GetReleaseTargetsForDeployment,
	rtForDepEnv releasetargets.GetReleaseTargetsForDeploymentAndEnvironment,
	policiesForRT policies.GetPoliciesForReleaseTarget,
	jobsForRT releasetargets.GetJobsForReleaseTarget,
) Getter {
	return &PostgresGetter{
		gradualrolloutGetter: gradualrollout.NewPostgresGetters(
			queries,
			rtForDep,
			rtForDepEnv,
			policiesForRT,
			jobsForRT,
		),
		versioncooldown:      versioncooldown.NewPostgresGetters(queries, jobsForRT),
		deploymentdependency: deploymentdependency.NewPostgresGetters(queries),
	}
}

func (g *PostgresGetter) GetAllReleaseTargets(
	ctx context.Context,
	workspaceID string,
) ([]*oapi.ReleaseTarget, error) {
	return g.versioncooldown.GetAllReleaseTargets(ctx, workspaceID)
}

func (g *PostgresGetter) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return g.versioncooldown.GetJobVerificationStatus(jobID)
}

func (g *PostgresGetter) GetReleaseTargetsForResource(
	ctx context.Context,
	resourceID string,
) []*oapi.ReleaseTarget {
	return g.deploymentdependency.GetReleaseTargetsForResource(ctx, resourceID)
}

func (g *PostgresGetter) GetCurrentlyDeployedVersion(
	ctx context.Context,
	rt *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	return g.deploymentdependency.GetCurrentlyDeployedVersion(ctx, rt)
}

func (g *PostgresGetter) GetPlanValidationResultsForTarget(
	ctx context.Context,
	environmentID, resourceID, deploymentID string,
) ([]planvalidation.ValidationResult, error) {
	q := db.GetQueries(ctx)

	envID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, err
	}
	resID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, err
	}
	depID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, err
	}

	rows, err := q.GetLatestPlanValidationsForTarget(ctx, db.GetLatestPlanValidationsForTargetParams{
		EnvironmentID: envID,
		ResourceID:    resID,
		DeploymentID:  depID,
	})
	if err != nil {
		return nil, err
	}

	results := make([]planvalidation.ValidationResult, len(rows))
	for i, r := range rows {
		results[i] = planvalidation.ValidationResult{
			RuleID:     r.RuleID.String(),
			RuleName:   r.RuleName,
			Severity:   r.Severity,
			Passed:     r.Passed,
			Violations: r.Violations,
		}
	}
	return results, nil
}
