package relationshiprules

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func selectorFromString(s string) *oapi.Selector {
	if s == "" {
		return nil
	}
	sel := &oapi.Selector{}
	celJSON, _ := json.Marshal(oapi.CelSelector{Cel: s})
	_ = sel.UnmarshalJSON(celJSON)
	return sel
}

func selectorToString(sel *oapi.Selector) string {
	if sel == nil {
		return ""
	}
	cel, err := sel.AsCelSelector()
	if err == nil && cel.Cel != "" {
		return cel.Cel
	}
	return ""
}

func ToOapi(row db.RelationshipRule) *oapi.RelationshipRule {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	matcher := oapi.RelationshipRule_Matcher{}
	_ = json.Unmarshal(row.Matcher, &matcher)

	return &oapi.RelationshipRule{
		Id:               row.ID.String(),
		Name:             row.Name,
		Description:      description,
		WorkspaceId:      row.WorkspaceID.String(),
		FromType:         oapi.RelatableEntityType(row.FromType),
		ToType:           oapi.RelatableEntityType(row.ToType),
		RelationshipType: row.RelationshipType,
		Reference:        row.Reference,
		FromSelector:     selectorFromString(row.FromSelector.String),
		ToSelector:       selectorFromString(row.ToSelector.String),
		Matcher:          matcher,
		Metadata:         metadata,
	}
}

func ToUpsertParams(e *oapi.RelationshipRule) (db.UpsertRelationshipRuleParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertRelationshipRuleParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID, err := uuid.Parse(e.WorkspaceId)
	if err != nil {
		return db.UpsertRelationshipRuleParams{}, fmt.Errorf("parse workspace_id: %w", err)
	}

	var description pgtype.Text
	if e.Description != nil {
		description = pgtype.Text{String: *e.Description, Valid: true}
	}

	matcherBytes, err := json.Marshal(e.Matcher)
	if err != nil {
		return db.UpsertRelationshipRuleParams{}, fmt.Errorf("marshal matcher: %w", err)
	}

	metadata := e.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	fromSel := selectorToString(e.FromSelector)
	toSel := selectorToString(e.ToSelector)

	var fromSelector pgtype.Text
	if fromSel != "" {
		fromSelector = pgtype.Text{String: fromSel, Valid: true}
	}

	var toSelector pgtype.Text
	if toSel != "" {
		toSelector = pgtype.Text{String: toSel, Valid: true}
	}

	return db.UpsertRelationshipRuleParams{
		ID:               id,
		Name:             e.Name,
		Description:      description,
		WorkspaceID:      wsID,
		FromType:         string(e.FromType),
		ToType:           string(e.ToType),
		RelationshipType: e.RelationshipType,
		Reference:        e.Reference,
		FromSelector:     fromSelector,
		ToSelector:       toSelector,
		Matcher:          matcherBytes,
		Metadata:         metadata,
	}, nil
}
