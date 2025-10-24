package workspace

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/loader")

func Save(ctx context.Context, storage StorageClient, workspace *Workspace, snapshot *db.WorkspaceSnapshot) error {
	ctx, span := tracer.Start(ctx, "SaveWorkspace")
	defer span.End()

	span.SetAttributes(
		attribute.String("workspace.id", workspace.ID),
		attribute.String("snapshot.path", snapshot.Path),
	)

	data, err := workspace.GobEncode()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to encode workspace")
		return fmt.Errorf("failed to encode workspace: %w", err)
	}

	// Write to file with appropriate permissions
	if err := storage.Put(ctx, snapshot.Path, data); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to write workspace to disk")
		return fmt.Errorf("failed to write workspace to disk: %w", err)
	}

	if err := db.WriteWorkspaceSnapshot(ctx, workspace.ID, snapshot); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to write workspace snapshot")
		return fmt.Errorf("failed to write workspace snapshot: %w", err)
	}

	log.Info("Workspace saved to storage", "workspaceID", workspace.ID)

	return nil
}

func Load(ctx context.Context, storage StorageClient, workspace *Workspace) error {
	ctx, span := tracer.Start(ctx, "LoadWorkspace")
	defer span.End()

	span.SetAttributes(
		attribute.String("workspace.id", workspace.ID),
	)

	dbSnapshot, err := db.GetWorkspaceSnapshot(ctx, workspace.ID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "Failed to get workspace snapshot")
		return fmt.Errorf("failed to get workspace snapshot: %w", err)
	}

	if dbSnapshot == nil {
		log.Info("No workspace snapshot found, populating workspace with initial state", "workspaceID", workspace.ID)
		span.AddEvent("populated workspace from datatabse because no snapshot found")
		if err := PopulateWorkspaceWithInitialState(ctx, workspace); err != nil {
			return fmt.Errorf("failed to populate workspace with initial state: %w", err)
		}
		return nil
	}

	data, err := storage.Get(ctx, dbSnapshot.Path)
	if err != nil {
		return fmt.Errorf("failed to read workspace from disk: %w", err)
	}

	span.AddEvent("loaded workspace from disk")
	log.Info("Loading workspace from disk", "workspaceID", workspace.ID)

	return workspace.GobDecode(data)
}
