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

// getBucketURL parses a GCS URL like "gs://bucket-name/base-path"
// Returns bucket name and base path (without leading slash).
func getBucketURL() (string, string) {
	url := os.Getenv("WORKSPACE_STATES_BUCKET_URL")

	// Trim gs:// scheme
	url = strings.TrimPrefix(url, "gs://")

	// Split on first '/' to separate bucket and prefix
	parts := strings.SplitN(url, "/", 2)
	bucket := parts[0]
	prefix := ""

	if len(parts) > 1 {
		prefix = strings.TrimPrefix(parts[1], "/")
	}

	return bucket, prefix
}

func GetWorkspaceSnapshot(ctx context.Context, workspaceID string) ([]byte, error) {
	bucket, prefix := getBucketURL()

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

	// Prepend prefix to object path
	objectPath := snapshot.Path
	if prefix != "" {
		objectPath = prefix + "/" + snapshot.Path
	}

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
// Reads bucket URL from WORKSPACE_STATES_BUCKET_URL env variable.
func PutWorkspaceSnapshot(ctx context.Context, workspaceID string, timestamp string, partition int32, numPartitions int32, data []byte) error {
	bucket, prefix := getBucketURL()

	client, err := storage.NewClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCS client: %w", err)
	}
	defer client.Close()

	// Base path for the object (without prefix)
	path := fmt.Sprintf("%s_%s.gob", workspaceID, timestamp)

	// Prepend prefix to object path
	objectPath := path
	if prefix != "" {
		objectPath = prefix + "/" + path
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
