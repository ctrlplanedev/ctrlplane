package desiredrelease

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/sync/singleflight"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

type policiesGetter = policyeval.Getter
type variableResolverGetter = variableresolver.Getter

var _ Getter = (*PostgresGetter)(nil)

func NewPostgresGetter(
	queries *db.Queries,
	rtForDep releasetargets.GetReleaseTargetsForDeployment,
	rtForDepEnv releasetargets.GetReleaseTargetsForDeploymentAndEnvironment,
	policiesForRT policies.GetPoliciesForReleaseTarget,
	jobsForRT releasetargets.GetJobsForReleaseTarget,
) *PostgresGetter {
	return &PostgresGetter{
		policiesGetter: policyeval.NewPostgresGetter(
			queries,
			rtForDep,
			rtForDepEnv,
			policiesForRT,
			jobsForRT,
		),
		variableResolverGetter: variableresolver.NewPostgresGetter(queries),
	}
}

type PostgresGetter struct {
	policiesGetter
	variableResolverGetter

	versionsSF singleflight.Group
}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetReleaseTargetScope(
	ctx context.Context,
	rt *ReleaseTarget,
) (*evaluator.EvaluatorScope, error) {
	q := db.GetQueries(ctx)

	depRow, err := q.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", rt.DeploymentID, err)
	}

	envRow, err := q.GetEnvironmentByID(ctx, rt.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", rt.EnvironmentID, err)
	}

	resRow, err := q.GetResourceByID(ctx, rt.ResourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource %s: %w", rt.ResourceID, err)
	}

	return &evaluator.EvaluatorScope{
		Deployment:  db.ToOapiDeployment(depRow),
		Environment: db.ToOapiEnvironment(envRow),
		Resource:    db.ToOapiResource(resRow),
	}, nil
}

func (g *PostgresGetter) GetCandidateVersions(
	ctx context.Context,
	deploymentID uuid.UUID,
) ([]*oapi.DeploymentVersion, error) {
	key := deploymentID.String()
	v, err, _ := g.versionsSF.Do(key, func() (any, error) {
		rows, err := db.GetQueries(ctx).
			ListDeployableVersionsByDeploymentID(ctx, db.ListDeployableVersionsByDeploymentIDParams{
				DeploymentID: deploymentID,
				Limit:        pgtype.Int4{Int32: 500, Valid: true},
			})
		if err != nil {
			return nil, fmt.Errorf("list versions for deployment %s: %w", deploymentID, err)
		}

		versions := make([]*oapi.DeploymentVersion, 0, len(rows))
		for _, row := range rows {
			versions = append(versions, db.ToOapiDeploymentVersion(row))
		}
		return versions, nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]*oapi.DeploymentVersion), nil
}

func (g *PostgresGetter) GetApprovalRecords(
	ctx context.Context,
	versionID, environmentID string,
) ([]*oapi.UserApprovalRecord, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	approvalRecords, err := db.GetQueries(ctx).
		ListApprovedRecordsByVersionAndEnvironment(ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
			VersionID:     versionIDUUID,
			EnvironmentID: environmentIDUUID,
		})
	if err != nil {
		return nil, fmt.Errorf("list approval records for workspace %s: %w", versionID, err)
	}
	approvalRecordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(approvalRecords))
	for _, approvalRecord := range approvalRecords {
		approvalRecordsOAPI = append(
			approvalRecordsOAPI,
			db.ToOapiUserApprovalRecord(approvalRecord),
		)
	}
	return approvalRecordsOAPI, nil
}

func (g *PostgresGetter) GetPolicySkips(
	ctx context.Context,
	versionID, environmentID, resourceID string,
) ([]*oapi.PolicySkip, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	resourceIDUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	policySkips, err := db.GetQueries(ctx).
		ListPolicySkipsForTarget(ctx, db.ListPolicySkipsForTargetParams{
			VersionID:     versionIDUUID,
			EnvironmentID: environmentIDUUID,
			ResourceID:    resourceIDUUID,
		})
	if err != nil {
		return nil, fmt.Errorf("list policy skips for version %s: %w", versionID, err)
	}
	result := make([]*oapi.PolicySkip, 0, len(policySkips))
	for _, skip := range policySkips {
		result = append(result, db.ToOapiPolicySkip(skip))
	}
	return result, nil
}

