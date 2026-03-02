package policyskips

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

func (r *Repo) Get(id string) (*oapi.PolicySkip, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse policy skip id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetPolicySkipByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(row), true
}

func (r *Repo) Set(entity *oapi.PolicySkip) error {
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	return db.GetQueries(r.ctx).UpsertPolicySkip(r.ctx, params)
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeletePolicySkip(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.PolicySkip {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.PolicySkip)
	}

	rows, err := db.GetQueries(r.ctx).ListPolicySkipsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list policy skips by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.PolicySkip)
	}

	result := make(map[string]*oapi.PolicySkip, len(rows))
	for _, row := range rows {
		ps := ToOapi(row)
		result[ps.Id] = ps
	}
	return result
}

func (r *Repo) ListByVersionID(versionID string) ([]*oapi.PolicySkip, error) {
	vid, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListPolicySkipsByVersionID(r.ctx, vid)
	if err != nil {
		return nil, fmt.Errorf("list policy skips by version: %w", err)
	}

	result := make([]*oapi.PolicySkip, len(rows))
	for i, row := range rows {
		result[i] = ToOapi(row)
	}
	return result, nil
}
