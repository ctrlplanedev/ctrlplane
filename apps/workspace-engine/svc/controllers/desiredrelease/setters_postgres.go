package desiredrelease

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"

	"github.com/google/uuid"
)

type PostgresSetter struct {
	upsertRuleEvaluationsSetter
}

var _ Setter = (*PostgresSetter)(nil)

func NewPostgresSetter() *PostgresSetter {
	return &PostgresSetter{
		upsertRuleEvaluationsSetter: &policies.PostgresUpsertRuleEvaluations{},
	}
}

func (s *PostgresSetter) SetDesiredRelease(ctx context.Context, rt *ReleaseTarget, release *oapi.Release) error {
	q := db.GetQueries(ctx)

	if release == nil {
		_, err := q.UpsertReleaseDesired(ctx, db.UpsertReleaseDesiredParams{
			ResourceID:       rt.ResourceID,
			EnvironmentID:    rt.EnvironmentID,
			DeploymentID:     rt.DeploymentID,
			DesiredReleaseID: uuid.Nil,
		})
		return err
	}

	versionID, err := uuid.Parse(release.Version.Id)
	if err != nil {
		return fmt.Errorf("parse version id: %w", err)
	}

	variableKeys := make([]string, 0, len(release.Variables))
	variableValues := make([][]byte, 0, len(release.Variables))
	for key, val := range release.Variables {
		variableKeys = append(variableKeys, key)
		valBytes, err := json.Marshal(val)
		if err != nil {
			return fmt.Errorf("marshal variable %q: %w", key, err)
		}
		variableValues = append(variableValues, valBytes)
	}

	releaseRow, err := q.FindOrCreateRelease(ctx, db.FindOrCreateReleaseParams{
		ID:            release.UUID(),
		ResourceID:    rt.ResourceID,
		EnvironmentID: rt.EnvironmentID,
		DeploymentID:  rt.DeploymentID,
		VersionID:     versionID,
		VariableKeys:  variableKeys,
		VariableValues: variableValues,
	})
	if err != nil {
		return fmt.Errorf("upsert release: %w", err)
	}

	_, err = q.UpsertReleaseDesired(ctx, db.UpsertReleaseDesiredParams{
		ResourceID:       rt.ResourceID,
		EnvironmentID:    rt.EnvironmentID,
		DeploymentID:     rt.DeploymentID,
		DesiredReleaseID: releaseRow.ID,
	})
	if err != nil {
		return fmt.Errorf("upsert release desired: %w", err)
	}

	return nil
}
