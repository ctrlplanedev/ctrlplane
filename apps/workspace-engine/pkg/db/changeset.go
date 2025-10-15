package db

import (
	"context"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

func FlushChangeset(ctx context.Context, cs *changeset.ChangeSet[any]) error {
	cs.Mutex.Lock()
	defer cs.Mutex.Unlock()

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
		if err := applyChange(ctx, tx, change); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	cs.Changes = cs.Changes[:0] // Clear changes
	return nil
}

func applyChange(ctx context.Context, conn pgx.Tx, change changeset.Change[any]) error {
	if e, ok := change.Entity.(*oapi.Resource); ok && e != nil {
		if change.Type == changeset.ChangeTypeDelete {
			return deleteResource(ctx, e.Id, conn)
		}
		return writeResource(ctx, e, conn)
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

	return fmt.Errorf("unknown entity type: %s", change.Entity)
}

type DbChangesetConsumer struct{}

var _ changeset.ChangesetConsumer[any] = (*DbChangesetConsumer)(nil)

func NewChangesetConsumer() *DbChangesetConsumer {
	return &DbChangesetConsumer{}
}

func (c *DbChangesetConsumer) FlushChangeset(ctx context.Context, changeset *changeset.ChangeSet[any]) error {
	return FlushChangeset(ctx, changeset)
}
