package workspace

import (
	"context"
	"errors"

	"github.com/charmbracelet/log"
)

var ErrWorkspaceSnapshotNotFound = errors.New("workspace snapshot not found")

type WorkspaceStorageObject struct {
	ID        string
	StoreData []byte
}

var Storage StorageClient = nil

func init() {
	log.Info("Initializing workspace storage")
	ctx := context.Background()
	if IsGCSStorageEnabled() {
		log.Info("Using GCS storage")
		storage, err := NewGCSStorageClient(ctx)
		if err != nil {
			log.Error("Failed to create GCS storage", "error", err)
			panic(err)
		}
		Storage = storage
		return
	}

	log.Info("Using file storage")
	storage := NewFileStorage("./state")
	Storage = storage
}
