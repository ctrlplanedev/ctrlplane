package desiredrelease

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error) {
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
		Deployment:  convertDeployment(depRow),
		Environment: convertEnvironment(envRow),
		Resource:    convertResource(resRow),
	}, nil
}

func (g *PostgresGetter) GetCandidateVersions(ctx context.Context, deploymentID uuid.UUID) ([]*oapi.DeploymentVersion, error) {
	rows, err := db.GetQueries(ctx).ListDeploymentVersionsByDeploymentID(ctx, db.ListDeploymentVersionsByDeploymentIDParams{
		DeploymentID: deploymentID,
	})
	if err != nil {
		return nil, fmt.Errorf("list versions for deployment %s: %w", deploymentID, err)
	}

	versions := make([]*oapi.DeploymentVersion, 0, len(rows))
	for _, row := range rows {
		versions = append(versions, convertDeploymentVersion(row))
	}
	return versions, nil
}

func (g *PostgresGetter) GetPolicies(_ context.Context, _ *ReleaseTarget) ([]*oapi.Policy, error) {
	// TODO: Policies are not yet stored in the database.
	// When policy tables are added, implement DB-backed policy fetching here.
	return nil, nil
}

func convertDeployment(row db.Deployment) *oapi.Deployment {
	d := &oapi.Deployment{
		Id:             row.ID.String(),
		Name:           row.Name,
		JobAgentConfig: oapi.JobAgentConfig(row.JobAgentConfig),
		Metadata:       row.Metadata,
	}
	if row.Description != "" {
		d.Description = &row.Description
	}
	if row.JobAgentID != uuid.Nil {
		s := row.JobAgentID.String()
		d.JobAgentId = &s
	}
	return d
}

func convertEnvironment(row db.Environment) *oapi.Environment {
	e := &oapi.Environment{
		Id:       row.ID.String(),
		Name:     row.Name,
		Metadata: row.Metadata,
	}
	if row.Description.Valid {
		e.Description = &row.Description.String
	}
	if row.CreatedAt.Valid {
		e.CreatedAt = row.CreatedAt.Time
	}
	return e
}

func convertResource(row db.GetResourceByIDRow) *oapi.Resource {
	r := &oapi.Resource{
		Id:          row.ID.String(),
		Name:        row.Name,
		Version:     row.Version,
		Kind:        row.Kind,
		Identifier:  row.Identifier,
		WorkspaceId: row.WorkspaceID.String(),
		Config:      row.Config,
		Metadata:    row.Metadata,
	}
	if row.ProviderID != uuid.Nil {
		s := row.ProviderID.String()
		r.ProviderId = &s
	}
	if row.CreatedAt.Valid {
		r.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		t := row.UpdatedAt.Time
		r.UpdatedAt = &t
	}
	if row.DeletedAt.Valid {
		t := row.DeletedAt.Time
		r.DeletedAt = &t
	}
	return r
}

func convertDeploymentVersion(row db.DeploymentVersion) *oapi.DeploymentVersion {
	v := &oapi.DeploymentVersion{
		Id:             row.ID.String(),
		Name:           row.Name,
		Tag:            row.Tag,
		Config:         row.Config,
		JobAgentConfig: oapi.JobAgentConfig(row.JobAgentConfig),
		DeploymentId:   row.DeploymentID.String(),
		Metadata:       row.Metadata,
		Status:         oapi.DeploymentVersionStatus(row.Status),
	}
	if row.Message.Valid {
		v.Message = &row.Message.String
	}
	if row.CreatedAt.Valid {
		v.CreatedAt = row.CreatedAt.Time
	}
	return v
}
