package relationshipeval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"

	"github.com/google/uuid"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetEntityInfo(ctx context.Context, entityType string, entityID uuid.UUID) (*EntityInfo, error) {
	q := db.GetQueries(ctx)

	switch entityType {
	case "resource":
		row, err := q.GetActiveResourceByID(ctx, entityID)
		if err != nil {
			return nil, fmt.Errorf("get resource %s: %w", entityID, err)
		}
		return &EntityInfo{
			ID:          row.ID,
			WorkspaceID: row.WorkspaceID,
			EntityType:  "resource",
			Raw:         resourceRowToMap(row),
		}, nil

	case "deployment":
		row, err := q.GetDeploymentForRelEval(ctx, entityID)
		if err != nil {
			return nil, fmt.Errorf("get deployment %s: %w", entityID, err)
		}
		return &EntityInfo{
			ID:          row.ID,
			WorkspaceID: row.WorkspaceID,
			EntityType:  "deployment",
			Raw:         deploymentRowToMap(row),
		}, nil

	case "environment":
		row, err := q.GetEnvironmentForRelEval(ctx, entityID)
		if err != nil {
			return nil, fmt.Errorf("get environment %s: %w", entityID, err)
		}
		return &EntityInfo{
			ID:          row.ID,
			WorkspaceID: row.WorkspaceID,
			EntityType:  "environment",
			Raw:         environmentRowToMap(row),
		}, nil

	default:
		return nil, fmt.Errorf("unknown entity type %q for id %s", entityType, entityID)
	}
}

func (g *PostgresGetter) GetRulesForWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]RuleInfo, error) {
	q := db.GetQueries(ctx)

	rows, err := q.GetRelationshipRulesForWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("get rules for workspace %s: %w", workspaceID, err)
	}

	rules := make([]RuleInfo, 0, len(rows))
	for _, row := range rows {
		rules = append(rules, RuleInfo{
			ID:        row.ID,
			Reference: row.Reference,
			Cel:       row.Cel,
		})
	}
	return rules, nil
}

func (g *PostgresGetter) StreamCandidateEntities(ctx context.Context, workspaceID uuid.UUID, entityType string, batchSize int, batches chan<- []EntityInfo) error {
	defer close(batches)
	q := db.GetQueries(ctx)

	switch entityType {
	case "resource":
		rows, err := q.ListActiveResourcesByWorkspace(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("list resources for workspace %s: %w", workspaceID, err)
		}
		return sendBatches(ctx, batches, batchSize, rows, func(r db.ListActiveResourcesByWorkspaceRow) EntityInfo {
			return EntityInfo{
				ID: r.ID, WorkspaceID: r.WorkspaceID, EntityType: "resource",
				Raw: resourceListRowToMap(r),
			}
		})

	case "deployment":
		rows, err := q.ListDeploymentsByWorkspace(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("list deployments for workspace %s: %w", workspaceID, err)
		}
		return sendBatches(ctx, batches, batchSize, rows, func(r db.ListDeploymentsByWorkspaceRow) EntityInfo {
			return EntityInfo{
				ID: r.ID, WorkspaceID: r.WorkspaceID, EntityType: "deployment",
				Raw: deploymentListRowToMap(r),
			}
		})

	case "environment":
		rows, err := q.ListEnvironmentsByWorkspace(ctx, workspaceID)
		if err != nil {
			return fmt.Errorf("list environments for workspace %s: %w", workspaceID, err)
		}
		return sendBatches(ctx, batches, batchSize, rows, func(r db.ListEnvironmentsByWorkspaceRow) EntityInfo {
			return EntityInfo{
				ID: r.ID, WorkspaceID: r.WorkspaceID, EntityType: "environment",
				Raw: environmentListRowToMap(r),
			}
		})

	default:
		return fmt.Errorf("unknown entity type: %s", entityType)
	}
}

func (g *PostgresGetter) GetExistingRelationships(ctx context.Context, entityID uuid.UUID) ([]ExistingRelationship, error) {
	q := db.GetQueries(ctx)

	rows, err := q.GetExistingRelationshipsForEntity(ctx, entityID)
	if err != nil {
		return nil, fmt.Errorf("get existing relationships for entity %s: %w", entityID, err)
	}

	rels := make([]ExistingRelationship, 0, len(rows))
	for _, row := range rows {
		rels = append(rels, ExistingRelationship{
			RuleID:       row.RuleID,
			FromEntityID: row.FromEntityID,
			ToEntityID:   row.ToEntityID,
		})
	}
	return rels, nil
}

// sendBatches is a generic helper that partitions a slice of rows into
// fixed-size batches of EntityInfo and sends them on the channel.
func sendBatches[T any](ctx context.Context, batches chan<- []EntityInfo, batchSize int, rows []T, convert func(T) EntityInfo) error {
	batch := make([]EntityInfo, 0, batchSize)
	for _, row := range rows {
		batch = append(batch, convert(row))
		if len(batch) >= batchSize {
			select {
			case batches <- batch:
			case <-ctx.Done():
				return ctx.Err()
			}
			batch = make([]EntityInfo, 0, batchSize)
		}
	}
	if len(batch) > 0 {
		select {
		case batches <- batch:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

// --- Row-to-map converters (single-row lookups) ---

func resourceRowToMap(r db.GetActiveResourceByIDRow) map[string]any {
	m := map[string]any{
		"type":       "resource",
		"id":         r.ID.String(),
		"name":       r.Name,
		"kind":       r.Kind,
		"version":    r.Version,
		"identifier": r.Identifier,
		"config":     r.Config,
		"metadata":   stringMapToAnyMap(r.Metadata),
	}
	if r.ProviderID != uuid.Nil {
		m["providerId"] = r.ProviderID.String()
	}
	return m
}

func deploymentRowToMap(r db.GetDeploymentForRelEvalRow) map[string]any {
	m := map[string]any{
		"type":           "deployment",
		"id":             r.ID.String(),
		"name":           r.Name,
		"jobAgentConfig": r.JobAgentConfig,
		"metadata":       stringMapToAnyMap(r.Metadata),
	}
	if r.Description != "" {
		m["description"] = r.Description
	}
	if r.JobAgentID != uuid.Nil {
		m["jobAgentId"] = r.JobAgentID.String()
	}
	return m
}

func environmentRowToMap(r db.GetEnvironmentForRelEvalRow) map[string]any {
	m := map[string]any{
		"type":     "environment",
		"id":       r.ID.String(),
		"name":     r.Name,
		"metadata": stringMapToAnyMap(r.Metadata),
	}
	if r.Description.Valid {
		m["description"] = r.Description.String
	}
	return m
}

// --- Row-to-map converters (list queries) ---

func resourceListRowToMap(r db.ListActiveResourcesByWorkspaceRow) map[string]any {
	m := map[string]any{
		"type":       "resource",
		"id":         r.ID.String(),
		"name":       r.Name,
		"kind":       r.Kind,
		"version":    r.Version,
		"identifier": r.Identifier,
		"config":     r.Config,
		"metadata":   stringMapToAnyMap(r.Metadata),
	}
	if r.ProviderID != uuid.Nil {
		m["providerId"] = r.ProviderID.String()
	}
	return m
}

func deploymentListRowToMap(r db.ListDeploymentsByWorkspaceRow) map[string]any {
	m := map[string]any{
		"type":           "deployment",
		"id":             r.ID.String(),
		"name":           r.Name,
		"jobAgentConfig": r.JobAgentConfig,
		"metadata":       stringMapToAnyMap(r.Metadata),
	}
	if r.Description != "" {
		m["description"] = r.Description
	}
	if r.JobAgentID != uuid.Nil {
		m["jobAgentId"] = r.JobAgentID.String()
	}
	return m
}

func environmentListRowToMap(r db.ListEnvironmentsByWorkspaceRow) map[string]any {
	m := map[string]any{
		"type":     "environment",
		"id":       r.ID.String(),
		"name":     r.Name,
		"metadata": stringMapToAnyMap(r.Metadata),
	}
	if r.Description.Valid {
		m["description"] = r.Description.String
	}
	return m
}

func stringMapToAnyMap(m map[string]string) map[string]any {
	if m == nil {
		return nil
	}
	result := make(map[string]any, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}
