package policyskips

import (
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func ToOapi(row db.PolicySkip) *oapi.PolicySkip {
	var environmentId *string
	if row.EnvironmentID != uuid.Nil {
		s := row.EnvironmentID.String()
		environmentId = &s
	}

	var resourceId *string
	if row.ResourceID != uuid.Nil {
		s := row.ResourceID.String()
		resourceId = &s
	}

	var expiresAt *pgtype.Timestamptz
	if row.ExpiresAt.Valid {
		expiresAt = &row.ExpiresAt
	}

	ps := &oapi.PolicySkip{
		Id:            row.ID.String(),
		CreatedAt:     row.CreatedAt.Time,
		CreatedBy:     row.CreatedBy,
		EnvironmentId: environmentId,
		Reason:        row.Reason,
		ResourceId:    resourceId,
		RuleId:        row.RuleID.String(),
		VersionId:     row.VersionID.String(),
		WorkspaceId:   "",
	}

	if expiresAt != nil {
		ps.ExpiresAt = &expiresAt.Time
	}

	return ps
}

func ToUpsertParams(e *oapi.PolicySkip) (db.UpsertPolicySkipParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertPolicySkipParams{}, fmt.Errorf("parse id: %w", err)
	}

	ruleID, err := uuid.Parse(e.RuleId)
	if err != nil {
		return db.UpsertPolicySkipParams{}, fmt.Errorf("parse rule_id: %w", err)
	}

	versionID, err := uuid.Parse(e.VersionId)
	if err != nil {
		return db.UpsertPolicySkipParams{}, fmt.Errorf("parse version_id: %w", err)
	}

	var environmentID uuid.UUID
	if e.EnvironmentId != nil {
		environmentID, err = uuid.Parse(*e.EnvironmentId)
		if err != nil {
			return db.UpsertPolicySkipParams{}, fmt.Errorf("parse environment_id: %w", err)
		}
	}

	var resourceID uuid.UUID
	if e.ResourceId != nil {
		resourceID, err = uuid.Parse(*e.ResourceId)
		if err != nil {
			return db.UpsertPolicySkipParams{}, fmt.Errorf("parse resource_id: %w", err)
		}
	}

	var createdAt pgtype.Timestamptz
	if !e.CreatedAt.IsZero() {
		createdAt = pgtype.Timestamptz{Time: e.CreatedAt, Valid: true}
	}

	var expiresAt pgtype.Timestamptz
	if e.ExpiresAt != nil {
		expiresAt = pgtype.Timestamptz{Time: *e.ExpiresAt, Valid: true}
	}

	return db.UpsertPolicySkipParams{
		ID:            id,
		CreatedBy:     e.CreatedBy,
		EnvironmentID: environmentID,
		ExpiresAt:     expiresAt,
		Reason:        e.Reason,
		ResourceID:    resourceID,
		RuleID:        ruleID,
		VersionID:     versionID,
		CreatedAt:     createdAt,
	}, nil
}
