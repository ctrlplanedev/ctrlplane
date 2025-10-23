package workspace

import (
	"errors"
)

var ErrWorkspaceSnapshotNotFound = errors.New("workspace snapshot not found")

type WorkspaceStorageObject struct {
	ID        string
	StoreData []byte
}
