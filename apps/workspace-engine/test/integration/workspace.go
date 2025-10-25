package integration

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/workspace"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type PersistenceMode int

const (
	InMemoryOnly PersistenceMode = iota
	WithDiskPersistence
)

type TestWorkspace struct {
	t               *testing.T
	workspace       *workspace.Workspace
	persistenceMode PersistenceMode
	tempDir         string
	eventProducer   events.EventProducer
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
	
	tw := &TestWorkspace{}
	tw.t = t
	tw.persistenceMode = InMemoryOnly // Default to in-memory

	ctx := t.Context()

	// Create a handler function that will route to the event listener
	var eventListener *handler.EventListener
	memoryEventHandler := func(ctx context.Context, msg *kafka.Message, offsetTracker handler.OffsetTracker) error {
		if eventListener == nil {
			return fmt.Errorf("event listener not initialized")
		}
		_, err := eventListener.ListenAndRoute(ctx, msg, offsetTracker)
		return err
	}

	eventProducer := events.NewInMemoryProducer(ctx, memoryEventHandler)
	eventListener = events.NewEventHandler(eventProducer)
	
	// Create workspace with the event producer
	ws := workspace.GetNoFlushWorkspace(workspaceID, eventProducer)
	tw.workspace = ws
	tw.eventProducer = eventProducer

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

	if err := tw.eventProducer.ProduceEvent(string(eventType), tw.workspace.ID, data); err != nil {
		tw.t.Fatalf("failed to produce event: %v", err)
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

// Flush waits for all queued events to be processed and materialized views to be computed.
// Call this before making assertions in tests.
func (tw *TestWorkspace) Flush() {
	tw.t.Helper()
	if producer, ok := tw.eventProducer.(*events.InMemoryProducer); ok {
		producer.Flush()
		
		// Also wait for materialized view computations to complete
		// by calling Items() which will wait if a recomputation is in progress
		ctx := context.Background()
		_, _ = tw.workspace.Store().ReleaseTargets.Items(ctx)
	}
}
