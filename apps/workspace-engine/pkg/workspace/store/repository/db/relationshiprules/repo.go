package relationshiprules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
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

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.RelationshipRule) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	return db.GetQueries(r.ctx).UpsertRelationshipRule(r.ctx, params)
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
		rr := ToOapi(row)
		result[rr.Id] = rr
	}
	return result
}
