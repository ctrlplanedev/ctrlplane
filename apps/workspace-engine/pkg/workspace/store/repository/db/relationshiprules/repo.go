package relationshiprules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.RelationshipRule, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse relationship rule id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetRelationshipRuleByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return toOapi(row.ID, row.Name, row.Description, row.WorkspaceID, row.Reference, row.Cel, row.Metadata), true
}

func (r *Repo) Set(entity *oapi.RelationshipRule) error {
	params, err := toUpsertParams(entity, r.workspaceID)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertRelationshipRule(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert relationship rule: %w", err)
	}
	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteRelationshipRule(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.RelationshipRule {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.RelationshipRule)
	}

	rows, err := db.GetQueries(r.ctx).ListRelationshipRulesByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list relationship rules by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.RelationshipRule)
	}

	result := make(map[string]*oapi.RelationshipRule, len(rows))
	for _, row := range rows {
		rule := toOapi(row.ID, row.Name, row.Description, row.WorkspaceID, row.Reference, row.Cel, row.Metadata)
		result[rule.Id] = rule
	}
	return result
}

func toOapi(
	id uuid.UUID, name string, description pgtype.Text,
	workspaceID uuid.UUID, reference, cel string,
	metadata map[string]string,
) *oapi.RelationshipRule {
	rule := &oapi.RelationshipRule{
		Id:          id.String(),
		Name:        name,
		Reference:   reference,
		WorkspaceId: workspaceID.String(),
	}

	if description.Valid {
		rule.Description = &description.String
	}

	if metadata != nil {
		rule.Metadata = metadata
	} else {
		rule.Metadata = make(map[string]string)
	}

	if err := rule.Matcher.FromCelMatcher(oapi.CelMatcher{Cel: cel}); err != nil {
		log.Warn("Failed to set CelMatcher from DB cel", "id", id, "error", err)
	}

	return rule
}

func toUpsertParams(entity *oapi.RelationshipRule, workspaceID string) (db.UpsertRelationshipRuleParams, error) {
	id, err := uuid.Parse(entity.Id)
	if err != nil {
		return db.UpsertRelationshipRuleParams{}, fmt.Errorf("parse id: %w", err)
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		wsID, err = uuid.Parse(entity.WorkspaceId)
		if err != nil {
			return db.UpsertRelationshipRuleParams{}, fmt.Errorf("parse workspace_id: %w", err)
		}
	}

	cel, err := composeCel(entity)
	if err != nil {
		return db.UpsertRelationshipRuleParams{}, fmt.Errorf("compose cel: %w", err)
	}

	var description pgtype.Text
	if entity.Description != nil {
		description = pgtype.Text{String: *entity.Description, Valid: true}
	}

	metadata := entity.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	return db.UpsertRelationshipRuleParams{
		ID:          id,
		Name:        entity.Name,
		Description: description,
		WorkspaceID: wsID,
		Reference:   entity.Reference,
		Cel:         cel,
		Metadata:    metadata,
	}, nil
}

// composeCel builds the flat CEL string from the structured oapi fields.
// The format is: from.type == "{fromType}" && to.type == "{toType}" && {matcherCel}
func composeCel(entity *oapi.RelationshipRule) (string, error) {
	celMatcher, err := entity.Matcher.AsCelMatcher()
	if err != nil {
		return "", fmt.Errorf("extract cel from matcher: %w", err)
	}

	matcherCel := celMatcher.Cel

	fromType := string(entity.FromType)
	toType := string(entity.ToType)
	if fromType == "" || toType == "" {
		return matcherCel, nil
	}

	return fmt.Sprintf(`from.type == "%s" && to.type == "%s" && %s`, fromType, toType, matcherCel), nil
}
