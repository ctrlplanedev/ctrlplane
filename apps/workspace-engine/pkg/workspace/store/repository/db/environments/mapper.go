package environments

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func selectorFromString(s string) *oapi.Selector {
	if s == "" || s == "false" {
		return nil
	}
	sel := &oapi.Selector{}
	celJSON, _ := json.Marshal(oapi.CelSelector{Cel: s})
	_ = sel.UnmarshalJSON(celJSON)
	return sel
}

func selectorToString(sel *oapi.Selector) string {
	if sel == nil {
		return "false"
	}
	cel, err := sel.AsCelSelector()
	if err == nil && cel.Cel != "" {
		return cel.Cel
	}
	return "false"
}

// ToOapi converts a db.Environment into an oapi.Environment.
func ToOapi(row db.Environment) *oapi.Environment {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	return &oapi.Environment{
		Id:               row.ID.String(),
		Name:             row.Name,
		Description:      description,
		ResourceSelector: selectorFromString(row.ResourceSelector),
		Metadata:         metadata,
		CreatedAt:        row.CreatedAt.Time,
	}
}

// ToUpsertParams converts an oapi.Environment into sqlc upsert params.
func ToUpsertParams(e *oapi.Environment) (db.UpsertEnvironmentParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertEnvironmentParams{}, fmt.Errorf("parse id: %w", err)
	}

	var description pgtype.Text
	if e.Description != nil {
		description = pgtype.Text{String: *e.Description, Valid: true}
	}

	metadata := e.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	var createdAt pgtype.Timestamptz
	if !e.CreatedAt.IsZero() {
		createdAt = pgtype.Timestamptz{Time: e.CreatedAt, Valid: true}
	}

	return db.UpsertEnvironmentParams{
		ID:               id,
		Name:             e.Name,
		Description:      description,
		ResourceSelector: selectorToString(e.ResourceSelector),
		Metadata:         metadata,
		WorkspaceID:      uuid.Nil, // set by caller
		CreatedAt:        createdAt,
	}, nil
}
