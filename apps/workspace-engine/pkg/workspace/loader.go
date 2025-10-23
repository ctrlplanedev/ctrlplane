package workspace

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"

	"github.com/charmbracelet/log"
)

func Save(ctx context.Context, storage StorageClient, workspace *Workspace, snapshot *db.WorkspaceSnapshot) error {
	data, err := workspace.GobEncode()
	if err != nil {
		return fmt.Errorf("failed to encode workspace: %w", err)
	}
	// Write to file with appropriate permissions
	if err := storage.Put(ctx, snapshot.Path, data); err != nil {
		return fmt.Errorf("failed to write workspace to disk: %w", err)
	}

	if err := db.WriteWorkspaceSnapshot(ctx, workspace.ID, snapshot); err != nil {
		return fmt.Errorf("failed to write workspace snapshot: %w", err)
	}

	return nil
}

func Load(ctx context.Context, storage StorageClient, workspace *Workspace) error {
	dbSnapshot, err := db.GetWorkspaceSnapshot(ctx, workspace.ID)
	if err != nil {
		return fmt.Errorf("failed to get workspace snapshot: %w", err)
	}

	if dbSnapshot == nil {
		log.Info("No workspace snapshot found, populating workspace with initial state", "workspaceID", workspace.ID)
		if err := PopulateWorkspaceWithInitialState(ctx, workspace); err != nil {
			return fmt.Errorf("failed to populate workspace with initial state: %w", err)
		}
		return nil
	}

	data, err := storage.Get(ctx, dbSnapshot.Path)
	if err != nil {
		return fmt.Errorf("failed to read workspace from disk: %w", err)
	}

	log.Info("Loading workspace from disk", "workspaceID", workspace.ID)
	return workspace.GobDecode(data)
}
