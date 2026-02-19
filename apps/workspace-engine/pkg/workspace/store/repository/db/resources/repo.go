package resources

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// Repo implements repository.ResourceRepo backed by the resource table.
type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.Resource, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse resource id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetResourceByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ToOapi(ResourceRow(row)), true
}

func (r *Repo) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	wsUID, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for GetByIdentifier", "id", r.workspaceID, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetResourceByIdentifier(r.ctx, db.GetResourceByIdentifierParams{
		WorkspaceID: wsUID,
		Identifier:  identifier,
	})
	if err != nil {
		return nil, false
	}

	return ToOapi(ResourceRow(row)), true
}

func (r *Repo) Set(entity *oapi.Resource) error {
	entity.WorkspaceId = r.workspaceID
	params, err := ToUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertResource(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert resource: %w", err)
	}
	return nil
}

func (r *Repo) SetBatch(entities []*oapi.Resource) error {
	if len(entities) == 0 {
		return nil
	}

	batchParams := make([]db.BatchUpsertResourceParams, 0, len(entities))
	for _, entity := range entities {
		entity.WorkspaceId = r.workspaceID
		params, err := ToBatchUpsertParams(entity)
		if err != nil {
			return fmt.Errorf("convert to batch upsert params: %w", err)
		}
		batchParams = append(batchParams, params)
	}

	results := db.GetQueries(r.ctx).BatchUpsertResource(r.ctx, batchParams)
	var batchErr error
	results.Exec(func(i int, err error) {
		if err != nil && batchErr == nil {
			batchErr = fmt.Errorf("batch upsert resource %d: %w", i, err)
		}
	})
	return batchErr
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteResource(r.ctx, uid)
}

func (r *Repo) RemoveBatch(ids []string) error {
	if len(ids) == 0 {
		return nil
	}

	uuids := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		uid, err := uuid.Parse(id)
		if err != nil {
			return fmt.Errorf("parse id %q: %w", id, err)
		}
		uuids = append(uuids, uid)
	}

	return db.GetQueries(r.ctx).DeleteResourcesByIDs(r.ctx, uuids)
}

func (r *Repo) Items() map[string]*oapi.Resource {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Resource)
	}

	rows, err := db.GetQueries(r.ctx).ListResourcesByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list resources by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Resource)
	}

	result := make(map[string]*oapi.Resource, len(rows))
	for _, row := range rows {
		res := ToOapi(ResourceRow(row))
		result[res.Id] = res
	}
	return result
}

func (r *Repo) GetByIdentifiers(identifiers []string) map[string]*oapi.Resource {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for GetByIdentifiers()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Resource)
	}

	rows, err := db.GetQueries(r.ctx).ListResourcesByIdentifiers(r.ctx, db.ListResourcesByIdentifiersParams{
		WorkspaceID: uid,
		Column2:     identifiers,
	})
	if err != nil {
		log.Warn("Failed to list resources by identifiers", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Resource)
	}

	result := make(map[string]*oapi.Resource, len(rows))
	for _, row := range rows {
		res := ToOapi(ResourceRow(row))
		result[res.Identifier] = res
	}
	return result
}

func (r *Repo) GetSummariesByIdentifiers(identifiers []string) map[string]*repository.ResourceSummary {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for GetSummariesByIdentifiers()", "id", r.workspaceID, "error", err)
		return make(map[string]*repository.ResourceSummary)
	}

	rows, err := db.GetQueries(r.ctx).ListResourceSummariesByIdentifiers(r.ctx, db.ListResourceSummariesByIdentifiersParams{
		WorkspaceID: uid,
		Column2:     identifiers,
	})
	if err != nil {
		log.Warn("Failed to list resource summaries by identifiers", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*repository.ResourceSummary)
	}

	result := make(map[string]*repository.ResourceSummary, len(rows))
	for _, row := range rows {
		s := ToSummary(row)
		result[s.Identifier] = s
	}
	return result
}

func (r *Repo) ListByProviderID(providerID string) []*oapi.Resource {
	uid, err := uuid.Parse(providerID)
	if err != nil {
		log.Warn("Failed to parse provider id for ListByProviderID()", "id", providerID, "error", err)
		return nil
	}

	rows, err := db.GetQueries(r.ctx).ListResourcesByProviderID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list resources by provider", "providerId", providerID, "error", err)
		return nil
	}

	result := make([]*oapi.Resource, 0, len(rows))
	for _, row := range rows {
		result = append(result, ToOapi(ResourceRow(row)))
	}
	return result
}
