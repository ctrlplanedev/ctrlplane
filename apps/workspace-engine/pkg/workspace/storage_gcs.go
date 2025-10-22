package workspace

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"workspace-engine/pkg/db"

	"cloud.google.com/go/storage"
)

func IsGCSStorageEnabled() bool {
	return strings.HasPrefix(os.Getenv("WORKSPACE_STATES_BUCKET_URL"), "gcs://")
}

// getBucketURL parses a GCS URL like "gcs://bucket-name/base-path"
// Returns bucket name and base path.
func getBucketURL() string {
	return strings.TrimPrefix(os.Getenv("WORKSPACE_STATES_BUCKET_URL"), "gcs://")
}

func GetWorkspaceSnapshot(ctx context.Context, workspaceID string) ([]byte, error) {
	bucket := getBucketURL()

	snapshot, err := db.GetWorkspaceSnapshot(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	if snapshot == nil {
		return nil, nil
	}

	if snapshot.Path == "" {
		return nil, nil
	}

	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w", err)
	}
	defer client.Close()

	obj := client.Bucket(bucket).Object(snapshot.Path)
	reader, err := obj.NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to read snapshot: %w", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read data: %w", err)
	}

	return data, nil
}

// PutWorkspaceSnapshot writes a new timestamped snapshot for a workspace to GCS.
// Reads bucket URL from WORKSPACE_STATES_BUCKET_URL env variable.
func PutWorkspaceSnapshot(ctx context.Context, workspaceID string, timestamp string, partition int32, numPartitions int32, data []byte) error {
	bucket := getBucketURL()

	client, err := storage.NewClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCS client: %w", err)
	}
	defer client.Close()

	path := fmt.Sprintf("%s_%s.gob", workspaceID, timestamp)

	obj := client.Bucket(bucket).Object(path)
	writer := obj.NewWriter(ctx)

	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close writer: %w", err)
	}

	snapshot := &db.WorkspaceSnapshot{
		Path:          path,
		Timestamp:     timestamp,
		Partition:     partition,
		NumPartitions: numPartitions,
	}
	if err := db.WriteWorkspaceSnapshot(ctx, workspaceID, snapshot); err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	return nil
}
