package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/manager"
	"workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
)

var globalTraceStore = spanstore.NewInMemoryStore()

func init() {
	manager.Configure(
		manager.WithPersistentStore(memory.NewStore()),
		manager.WithWorkspaceCreateOptions(
			workspace.WithTraceStore(
				globalTraceStore,
			),
		),
	)
}

type TestWorkspace struct {
	t             *testing.T
	workspace     *workspace.Workspace
	eventListener *handler.EventListener
	traceStore    *spanstore.InMemoryStore
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
	tw.traceStore = globalTraceStore

	for _, option := range options {
		if err := option(tw); err != nil {
			tw.t.Fatalf("failed to apply option: %v", err)
		}
	}

	return tw
}

func (tw *TestWorkspace) Workspace() *workspace.Workspace {
	return tw.workspace
}

func (tw *TestWorkspace) TraceStore() *spanstore.InMemoryStore {
	return tw.traceStore
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

	return tw
}

// RunWithEngines runs the same test function against multiple pre-configured engines.
// This is useful for testing the same behavior with different configurations
// (e.g., standalone resources vs provider-owned resources).
//
// Example:
//
//	RunWithEngines(t, map[string]*TestWorkspace{
//	    "standalone": integration.NewTestWorkspace(t, opts1...),
//	    "with provider": integration.NewTestWorkspace(t, opts2...),
//	}, func(t *testing.T, engine *TestWorkspace) {
//	    // Your test code here
//	})
func RunWithEngines(t *testing.T, engines map[string]*TestWorkspace, testFn func(t *testing.T, engine *TestWorkspace)) {
	t.Helper()

	for name, engine := range engines {
		t.Run(name, func(t *testing.T) {
			testFn(t, engine)
		})
	}
}
