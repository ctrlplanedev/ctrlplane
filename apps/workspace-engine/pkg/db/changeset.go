package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

func FlushChangeset(ctx context.Context, cs *changeset.ChangeSet[any], workspaceID string, store *store.Store) error {
	ctx, span := tracer.Start(ctx, "DBFlushChangeset")
	defer span.End()

	span.SetAttributes(attribute.String("workspace.id", workspaceID))
	span.SetAttributes(attribute.Int("changeset.count", len(cs.Changes)))

	cs.Lock()
	defer cs.Unlock()

	if len(cs.Changes) == 0 {
		return nil
	}

	conn, err := GetDB(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, change := range cs.Changes {
		_, changeSpan := tracer.Start(ctx, "ApplyChange")
		changeSpan.SetAttributes(attribute.String("change.type", string(change.Type)))
		changeSpan.SetAttributes(attribute.String("change.entity", fmt.Sprintf("%T: %+v", change.Entity, change.Entity)))
		if err := applyChange(ctx, tx, change, workspaceID, store); err != nil {
			changeSpan.RecordError(err)
			changeSpan.SetStatus(codes.Error, fmt.Sprintf("Failed to apply change: %v, change: %+v", err, change))
			changeSpan.End()
			return err
		}
		changeSpan.End()
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	cs.Changes = []changeset.Change[any]{}

	return nil
}

func applyChange(ctx context.Context, conn pgx.Tx, change changeset.Change[any], workspaceID string, store *store.Store) error {
	if e, ok := change.Entity.(*oapi.Resource); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteResource(ctx, e.Id, conn)
		}
		return writeResource(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.ResourceProvider); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteResourceProvider(ctx, e.Id, conn)
		}
		return writeResourceProvider(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.Deployment); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteDeployment(ctx, e.Id, conn)
		}
		return writeDeployment(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.Policy); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deletePolicy(ctx, e.Id, conn)
		}
		return writePolicy(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.RelationshipRule); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteRelationshipRule(ctx, e.Id, conn)
		}
		return writeRelationshipRule(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.JobAgent); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteJobAgent(ctx, e.Id, conn)
		}
		return writeJobAgent(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.System); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteSystem(ctx, e.Id, conn)
		}
		return writeSystem(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.DeploymentVariable); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteDeploymentVariable(ctx, e.Id, conn)
		}
		return writeDeploymentVariable(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.DeploymentVersion); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteDeploymentVersion(ctx, e.Id, conn)
		}
		return writeDeploymentVersion(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.Environment); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteEnvironment(ctx, e.Id, conn)
		}
		return writeEnvironment(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.UserApprovalRecord); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteUserApprovalRecord(ctx, e, conn)
		}
		return writeUserApprovalRecord(ctx, e, conn)
	}

	if e, ok := change.Entity.(*oapi.Release); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteRelease(ctx, e.ID(), conn)
		}
		return writeRelease(ctx, e, workspaceID, conn)
	}

	if e, ok := change.Entity.(*oapi.Job); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteJob(ctx, e.Id, conn)
		}
		return writeJob(ctx, e, store, conn)
	}

	if e, ok := change.Entity.(*oapi.ReleaseTarget); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteReleaseTarget(ctx, e, conn)
		}
		return writeReleaseTarget(ctx, e, conn)
	}

	return fmt.Errorf("unknown entity type: %s", change.Entity)
}

type DbChangesetConsumer struct {
	workspaceID string
	store       *store.Store
}

var _ changeset.ChangesetConsumer[any] = (*DbChangesetConsumer)(nil)

func NewChangesetConsumer(workspaceID string, store *store.Store) *DbChangesetConsumer {
	return &DbChangesetConsumer{
		workspaceID: workspaceID,
		store:       store,
	}
}

func (c *DbChangesetConsumer) FlushChangeset(ctx context.Context, changeset *changeset.ChangeSet[any]) error {
	return FlushChangeset(ctx, changeset, c.workspaceID, c.store)
}
