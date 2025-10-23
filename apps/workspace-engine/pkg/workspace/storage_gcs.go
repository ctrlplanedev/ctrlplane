package workspace

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"cloud.google.com/go/storage"
)

func IsGCSStorageEnabled() bool {
	return strings.HasPrefix(os.Getenv("WORKSPACE_STATES_BUCKET_URL"), "gs://")
}

var _ StorageClient = (*GCSStorageClient)(nil)

type GCSStorageClient struct {
	client *storage.Client
	bucket string
	prefix string
}

func NewGCSStorageClient(ctx context.Context) (StorageClient, error) {
	if !IsGCSStorageEnabled() {
		return nil, errors.New("gcs storage is not enabled")
	}

	bucketURL := os.Getenv("WORKSPACE_STATES_BUCKET_URL")

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
		return nil, err
	}
	return &GCSStorageClient{client: client, bucket: bucket, prefix: prefix}, nil
}

func (c *GCSStorageClient) Put(ctx context.Context, path string, data []byte) error {
	path = filepath.Join(c.prefix, path)
	obj := c.client.Bucket(c.bucket).Object(path)
	writer := obj.NewWriter(ctx)
	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("failed to write snapshot: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close writer: %w", err)
	}
	return nil
}

func (c *GCSStorageClient) Get(ctx context.Context, path string) ([]byte, error) {
	path = filepath.Join(c.prefix, path)
	obj := c.client.Bucket(c.bucket).Object(path)

	// Check if the object exists before trying to read
	_, err := obj.Attrs(ctx)
	if err != nil {
		if err == storage.ErrObjectNotExist {
			return nil, ErrWorkspaceSnapshotNotFound
		}
		return nil, fmt.Errorf("failed to stat GCS object: %w", err)
	}

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

func (c *GCSStorageClient) Close() error {
	return c.client.Close()
}