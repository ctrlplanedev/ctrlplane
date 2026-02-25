package resourcevariables

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type Repo struct {
	ctx context.Context
}

func NewRepo(ctx context.Context) *Repo {
	return &Repo{ctx: ctx}
}

func (r *Repo) Get(key string) (*oapi.ResourceVariable, bool) {
	resourceID, varKey, err := parseKey(key)
	if err != nil {
		log.Warn("Failed to parse resource variable key", "key", key, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetResourceVariable(r.ctx, db.GetResourceVariableParams{
		ResourceID: resourceID,
		Key:        varKey,
	})
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.ResourceVariable) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	return db.GetQueries(r.ctx).UpsertResourceVariable(r.ctx, params)
}

func (r *Repo) Remove(key string) error {
	resourceID, varKey, err := parseKey(key)
	if err != nil {
		return fmt.Errorf("parse key: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteResourceVariable(r.ctx, db.DeleteResourceVariableParams{
		ResourceID: resourceID,
		Key:        varKey,
	})
}

func (r *Repo) Items() map[string]*oapi.ResourceVariable {
	log.Warn("ResourceVariables.Items() called on DB repo — not scoped, returning empty map")
	return make(map[string]*oapi.ResourceVariable)
}

func (r *Repo) GetByResourceID(resourceID string) ([]*oapi.ResourceVariable, error) {
	rid, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListResourceVariablesByResourceID(r.ctx, rid)
	if err != nil {
		return nil, fmt.Errorf("list resource variables: %w", err)
	}

	result := make([]*oapi.ResourceVariable, len(rows))
	for i, row := range rows {
		result[i] = ToOapi(row)
	}
	return result, nil
}
