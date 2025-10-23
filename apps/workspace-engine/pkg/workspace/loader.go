package workspace

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
)

func getPath(workspaceID string, timestamp string) string {
	return fmt.Sprintf("%s_%s.gob", workspaceID, timestamp)
}

func LoadAll(ctx context.Context, storage StorageClient) error {
	workspaceIds := GetAllWorkspaceIds()
	for _, workspaceID := range workspaceIds {
		workspace := GetWorkspace(workspaceID)
		err := Load(ctx, storage, workspace)
		if err != nil {
			return err
		}
	}
	return nil
}

func Save(ctx context.Context, storage StorageClient, workspace *Workspace, snapshot *db.WorkspaceSnapshot) error {
	path := getPath(workspace.ID, time.Now().Format(time.RFC3339))

	data, err := workspace.GobEncode()
	if err != nil {
		return fmt.Errorf("failed to encode workspace: %w", err)
	}

	// Write to file with appropriate permissions
	if err := storage.Put(ctx, path, data); err != nil {
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
		if err := PopulateWorkspaceWithInitialState(ctx, workspace); err != nil {
			return fmt.Errorf("failed to populate workspace with initial state: %w", err)
		}
		return nil
	}

	dbSnapshotPath := dbSnapshot.Path

	data, err := storage.Get(ctx, dbSnapshotPath)
	if err != nil {
		return fmt.Errorf("failed to read workspace from disk: %w", err)
	}

	return workspace.GobDecode(data)
}