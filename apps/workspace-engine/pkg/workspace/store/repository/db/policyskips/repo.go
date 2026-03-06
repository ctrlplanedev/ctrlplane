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
	ctx context.Context
}

func NewRepo(ctx context.Context) *Repo {
	return &Repo{ctx: ctx}
}

func (r *Repo) Get(id string) (*oapi.PolicySkip, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse policy skip id", "id", id, "error", err)
		return nil, false
	}

	pool := db.GetPool(r.ctx)
	row := pool.QueryRow(r.ctx,
		`SELECT id, created_at, created_by, environment_id, expires_at, reason, resource_id, rule_id, version_id
		 FROM policy_skip WHERE id = $1`, uid)

	var ps db.PolicySkip
	if err := row.Scan(
		&ps.ID, &ps.CreatedAt, &ps.CreatedBy, &ps.EnvironmentID,
		&ps.ExpiresAt, &ps.Reason, &ps.ResourceID, &ps.RuleID, &ps.VersionID,
	); err != nil {
		return nil, false
	}

	return ToOapi(ps), true
}

func (r *Repo) Set(entity *oapi.PolicySkip) error {
	id, createdAt, createdBy, environmentID, expiresAt, reason, resourceID, ruleID, versionID, err := ToUpsertArgs(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert args: %w", err)
	}

	pool := db.GetPool(r.ctx)
	_, err = pool.Exec(r.ctx,
		`INSERT INTO policy_skip (id, created_at, created_by, environment_id, expires_at, reason, resource_id, rule_id, version_id)
		 VALUES ($1, $2, $3,
		   CASE WHEN $4 = '00000000-0000-0000-0000-000000000000'::uuid THEN NULL ELSE $4 END,
		   $5, $6,
		   CASE WHEN $7 = '00000000-0000-0000-0000-000000000000'::uuid THEN NULL ELSE $7 END,
		   $8, $9)
		 ON CONFLICT (id) DO UPDATE SET
		   created_by = EXCLUDED.created_by,
		   environment_id = EXCLUDED.environment_id,
		   expires_at = EXCLUDED.expires_at,
		   reason = EXCLUDED.reason,
		   resource_id = EXCLUDED.resource_id,
		   rule_id = EXCLUDED.rule_id,
		   version_id = EXCLUDED.version_id`,
		id, createdAt, createdBy, environmentID, expiresAt, reason, resourceID, ruleID, versionID,
	)
	if err != nil {
		return fmt.Errorf("upsert policy skip: %w", err)
	}
	return nil
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	pool := db.GetPool(r.ctx)
	_, err = pool.Exec(r.ctx, `DELETE FROM policy_skip WHERE id = $1`, uid)
	return err
}

func (r *Repo) Items() map[string]*oapi.PolicySkip {
	log.Warn("PolicySkips.Items() called on DB repo — not scoped, returning empty map")
	return make(map[string]*oapi.PolicySkip)
}
