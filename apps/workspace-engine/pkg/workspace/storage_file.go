package workspace

import (
	"context"
	"os"
	"path/filepath"
)

type StorageClient interface {
	Get(ctx context.Context, path string) ([]byte, error)
	Put(ctx context.Context, path string, data []byte) error
}

// FileStorage stores files in a specified base directory.
type FileStorage struct {
	BaseDir string
}

// NewFileStorage returns a FileStorage rooted at the given base directory.
func NewFileStorage(baseDir string) StorageClient {
	return &FileStorage{BaseDir: baseDir}
}

// Get reads the content of the file at the given path relative to BaseDir.
func (fs *FileStorage) Get(ctx context.Context, path string) ([]byte, error) {
	fullPath := filepath.Join(fs.BaseDir, path)
	return os.ReadFile(fullPath)
}

// Put writes data to the file at the given path relative to BaseDir, creating directories as needed.
func (fs *FileStorage) Put(ctx context.Context, path string, data []byte) error {
	fullPath := filepath.Join(fs.BaseDir, path)
	// Ensure the target directory exists.
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, data, 0644)
}
