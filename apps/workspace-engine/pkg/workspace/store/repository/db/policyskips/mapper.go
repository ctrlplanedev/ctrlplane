package policyskips

import (
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func ToOapi(row db.PolicySkip) *oapi.PolicySkip {
	var environmentID *string
	if row.EnvironmentID != uuid.Nil {
		s := row.EnvironmentID.String()
		environmentID = &s
	}

	var resourceID *string
	if row.ResourceID != uuid.Nil {
		s := row.ResourceID.String()
		resourceID = &s
	}

	var expiresAt *time.Time
	if row.ExpiresAt.Valid {
		expiresAt = &row.ExpiresAt.Time
	}

	return &oapi.PolicySkip{
		Id:            row.ID.String(),
		CreatedAt:     row.CreatedAt.Time,
		CreatedBy:     row.CreatedBy,
		EnvironmentId: environmentID,
		ExpiresAt:     expiresAt,
		Reason:        row.Reason,
		ResourceId:    resourceID,
		RuleId:        row.RuleID.String(),
		VersionId:     row.VersionID.String(),
	}
}

func ToUpsertArgs(e *oapi.PolicySkip) (
	id uuid.UUID,
	createdAt pgtype.Timestamptz,
	createdBy string,
	environmentID uuid.UUID,
	expiresAt pgtype.Timestamptz,
	reason string,
	resourceID uuid.UUID,
	ruleID uuid.UUID,
	versionID uuid.UUID,
	err error,
) {
	id, err = uuid.Parse(e.Id)
	if err != nil {
		return
	}

	ruleID, err = uuid.Parse(e.RuleId)
	if err != nil {
		return
	}

	versionID, err = uuid.Parse(e.VersionId)
	if err != nil {
		return
	}

	createdAt = pgtype.Timestamptz{Time: e.CreatedAt, Valid: !e.CreatedAt.IsZero()}
	createdBy = e.CreatedBy
	reason = e.Reason

	if e.EnvironmentId != nil {
		environmentID, err = uuid.Parse(*e.EnvironmentId)
		if err != nil {
			return
		}
	}

	if e.ResourceId != nil {
		resourceID, err = uuid.Parse(*e.ResourceId)
		if err != nil {
			return
		}
	}

	if e.ExpiresAt != nil {
		expiresAt = pgtype.Timestamptz{Time: *e.ExpiresAt, Valid: true}
	}

	return
}
