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
	return strings.HasPrefix(os.Getenv("WORKSPACE_STATES_BUCKET_URL"), "gs://")
}

func GetWorkspaceSnapshot(ctx context.Context, workspaceID string) ([]byte, error) {
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

	// Parse bucket/object/path from stored path
	parts := strings.SplitN(snapshot.Path, "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid GCS path: %s", snapshot.Path)
	}
	bucket := parts[0]
	objectPath := parts[1]

	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w", err)
	}
	defer client.Close()

	obj := client.Bucket(bucket).Object(objectPath)
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
func PutWorkspaceSnapshot(ctx context.Context, workspaceID string, timestamp string, partition int32, numPartitions int32, data []byte) error {
	// Get bucket URL like "gs://bucket-name" or "gs://bucket-name/prefix"
	bucketURL := os.Getenv("WORKSPACE_STATES_BUCKET_URL")
	bucketURL = strings.TrimSuffix(bucketURL, "/")

	// Parse bucket and optional prefix
	gsPath := strings.TrimPrefix(bucketURL, "gs://")
	parts := strings.SplitN(gsPath, "/", 2)
	bucket := parts[0]
	prefix := ""
	if len(parts) > 1 {
		prefix = parts[1]
	}

	client, err := storage.NewClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCS client: %w", err)
	}
	defer client.Close()

	// Generate object path
	objectName := fmt.Sprintf("%s_%s.gob", workspaceID, timestamp)
	objectPath := objectName
	if prefix != "" {
		objectPath = prefix + "/" + objectName
	}

	obj := client.Bucket(bucket).Object(objectPath)
	writer := obj.NewWriter(ctx)

	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close writer: %w", err)
	}

	// Store bucket/object/path in database (no gs:// prefix)
	fullPath := fmt.Sprintf("%s/%s", bucket, objectPath)

	snapshot := &db.WorkspaceSnapshot{
		Path:          fullPath,
		Timestamp:     timestamp,
		Partition:     partition,
		NumPartitions: numPartitions,
	}
	if err := db.WriteWorkspaceSnapshot(ctx, workspaceID, snapshot); err != nil {
		return fmt.Errorf("failed to write snapshot: %w", err)
	}

	return nil
}
