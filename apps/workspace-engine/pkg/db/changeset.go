package db

import (
	"context"
	"workspace-engine/pkg/workspace/changeset"

	"github.com/jackc/pgx/v5"
)

func FlushChangeset(ctx context.Context) error {
	cs, ok := changeset.FromContext(ctx)
	if !ok {
		return nil
	}

	if len(cs.Changes) == 0 {
        return nil
    }

	cs.Mutex.Lock()
    defer cs.Mutex.Unlock()

	conn, err := GetDB(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

    tx, err := conn.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

	for _, change := range cs.Changes {
		if err := applyInsert(ctx, tx, change); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
        return err
    }
    
    cs.Changes = cs.Changes[:0] // Clear changes
    return nil
}

func applyInsert(ctx context.Context, conn pgx.Tx, change changeset.Change) error {
	// TODO: Implement
	return nil
}