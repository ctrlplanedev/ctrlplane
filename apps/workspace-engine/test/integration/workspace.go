package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"
)

type PersistenceMode int

const (
	InMemoryOnly PersistenceMode = iota
	WithDiskPersistence
)

type TestWorkspace struct {
	t               *testing.T
	workspace       *workspace.Workspace
	eventListener   *handler.EventListener
	persistenceMode PersistenceMode
	tempDir         string
}

func NewTestWorkspace(
	t *testing.T,
	options ...WorkspaceOption,
) *TestWorkspace {
	if t == nil {
		t = &testing.T{}
	}
	t.Helper()

	workspaceID := fmt.Sprintf("test-workspace-%d", time.Now().UnixNano())
	ws, err := manager.GetOrLoad(context.Background(), workspaceID)
	if err != nil {
		t.Fatalf("failed to get or create workspace: %v", err)
	}

	tw := &TestWorkspace{}
	tw.t = t
	tw.workspace = ws
	tw.eventListener = events.NewEventHandler()
	tw.persistenceMode = InMemoryOnly // Default to in-memory

	for _, option := range options {
		if err := option(tw); err != nil {
			tw.t.Fatalf("failed to apply option: %v", err)
		}
	}

	// Set up temp directory for persistence mode
	if tw.persistenceMode == WithDiskPersistence {
		tempDir, err := os.MkdirTemp("", "workspace-test-*")
		if err != nil {
			tw.t.Fatalf("failed to create temp directory: %v", err)
		}
		tw.tempDir = tempDir

		// Clean up temp directory when test completes
		t.Cleanup(func() {
			os.RemoveAll(tempDir)
		})
	}

	return tw
}

func (tw *TestWorkspace) Workspace() *workspace.Workspace {
	return tw.workspace
}

// SaveToDisk serializes the workspace state to a file
func (tw *TestWorkspace) SaveToDisk() error {
	tw.t.Helper()

	if tw.persistenceMode != WithDiskPersistence {
		return nil // No-op for in-memory mode
	}

	// Encode the workspace using gob
	data, err := tw.workspace.GobEncode()
	if err != nil {
		return fmt.Errorf("failed to encode workspace: %w", err)
	}

	// Write to file
	filePath := filepath.Join(tw.tempDir, "workspace.gob")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write workspace to disk: %w", err)
	}

	return nil
}

// LoadFromDisk deserializes the workspace state from a file
func (tw *TestWorkspace) LoadFromDisk() error {
	tw.t.Helper()

	if tw.persistenceMode != WithDiskPersistence {
		return nil // No-op for in-memory mode
	}

	// Read from file
	filePath := filepath.Join(tw.tempDir, "workspace.gob")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read workspace from disk: %w", err)
	}

	// Decode the workspace
	if err := tw.workspace.GobDecode(data); err != nil {
		return fmt.Errorf("failed to decode workspace: %w", err)
	}

	return nil
}

// PushEvent sends an event through the event listener
// In persistence mode, it automatically saves and reloads state after processing
func (tw *TestWorkspace) PushEvent(ctx context.Context, eventType handler.EventType, data any) *TestWorkspace {
	tw.t.Helper()

	dataBytes, err := json.Marshal(data)
	if err != nil {
		tw.t.Fatalf("failed to marshal event data: %v", err)
		return tw
	}

	// Create raw event
	rawEvent := handler.RawEvent{
		EventType:   eventType,
		WorkspaceID: tw.workspace.ID,
		Data:        dataBytes,
	}

	// Marshal the full event
	eventBytes, err := json.Marshal(rawEvent)
	if err != nil {
		tw.t.Fatalf("failed to marshal raw event: %v", err)
		return tw
	}

	// Create a mock Kafka message
	topic := "test-topic"
	partition := int32(0)

	msg := &messaging.Message{
		Key:       []byte(topic),
		Value:     eventBytes,
		Partition: partition,
		Offset:    int64(1),
	}

	if _, err := tw.eventListener.ListenAndRoute(ctx, msg); err != nil {
		tw.t.Fatalf("failed to listen and route event: %v", err)
	}

	// In persistence mode, save and reload state to test serialization
	if tw.persistenceMode == WithDiskPersistence {
		if err := tw.SaveToDisk(); err != nil {
			tw.t.Fatalf("failed to save workspace to disk: %v", err)
		}
		if err := tw.LoadFromDisk(); err != nil {
			tw.t.Fatalf("failed to load workspace from disk: %v", err)
		}
	}

	return tw
}
