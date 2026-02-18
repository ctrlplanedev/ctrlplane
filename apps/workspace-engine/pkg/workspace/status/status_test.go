package status

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewWorkspaceStatus(t *testing.T) {
	ws := NewWorkspaceStatus("ws-123")
	require.NotNil(t, ws)
	assert.Equal(t, "ws-123", ws.WorkspaceID)
	assert.Equal(t, StateInitializing, ws.State)
	assert.NotZero(t, ws.StateEntered)
	assert.NotZero(t, ws.LastUpdated)
	assert.NotNil(t, ws.Metadata)
	assert.Empty(t, ws.StateHistory)
}

func TestSetState(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	ws.SetState(StateReady, "workspace loaded")
	assert.Equal(t, StateReady, ws.State)
	assert.Equal(t, "workspace loaded", ws.Message)
	assert.Len(t, ws.StateHistory, 1)
	assert.Equal(t, StateInitializing, ws.StateHistory[0].FromState)
	assert.Equal(t, StateReady, ws.StateHistory[0].ToState)
}

func TestSetState_HistoryLimit(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	for i := 0; i < 25; i++ {
		ws.SetState(WorkspaceState(fmt.Sprintf("state-%d", i)), "")
	}
	assert.Len(t, ws.StateHistory, 20, "History should be capped at 20")
}

func TestSetError(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	ws.SetError(fmt.Errorf("something went wrong"))
	assert.Equal(t, StateError, ws.State)
	assert.Equal(t, "something went wrong", ws.ErrorMessage)
	assert.Len(t, ws.StateHistory, 1)
	assert.Equal(t, StateInitializing, ws.StateHistory[0].FromState)
	assert.Equal(t, StateError, ws.StateHistory[0].ToState)
}

func TestSetError_HistoryLimit(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	for i := 0; i < 25; i++ {
		ws.SetError(fmt.Errorf("error %d", i))
	}
	assert.Len(t, ws.StateHistory, 20, "History should be capped at 20")
}

func TestUpdateMetadata(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	ws.UpdateMetadata("entity_count", 42)
	ws.UpdateMetadata("loaded", true)
	assert.Equal(t, 42, ws.Metadata["entity_count"])
	assert.Equal(t, true, ws.Metadata["loaded"])
}

func TestGetSnapshot(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	ws.SetState(StateReady, "ready")
	ws.UpdateMetadata("count", 10)

	snap := ws.GetSnapshot()
	assert.Equal(t, "ws-1", snap.WorkspaceID)
	assert.Equal(t, StateReady, snap.State)
	assert.Equal(t, "ready", snap.Message)
	assert.Equal(t, 10, snap.Metadata["count"])
	assert.Len(t, snap.StateHistory, 1)

	// Mutating snapshot should not affect original
	snap.Metadata["count"] = 999
	assert.Equal(t, 10, ws.Metadata["count"])
}

func TestIsReady(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	assert.False(t, ws.IsReady())
	ws.SetState(StateReady, "loaded")
	assert.True(t, ws.IsReady())
}

func TestIsError(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	assert.False(t, ws.IsError())
	ws.SetError(fmt.Errorf("oops"))
	assert.True(t, ws.IsError())
}

func TestGetState(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	assert.Equal(t, StateInitializing, ws.GetState())
	ws.SetState(StateLoadingFromPersistence, "loading")
	assert.Equal(t, StateLoadingFromPersistence, ws.GetState())
}

func TestTimeInCurrentState(t *testing.T) {
	ws := NewWorkspaceStatus("ws-1")
	time.Sleep(10 * time.Millisecond)
	d := ws.TimeInCurrentState()
	assert.Greater(t, d, time.Duration(0))
}

// ---- Tracker Tests ----

func TestTracker_NewTracker(t *testing.T) {
	tracker := NewTracker()
	require.NotNil(t, tracker)
	assert.Equal(t, 0, tracker.Count())
}

func TestTracker_GetOrCreate(t *testing.T) {
	tracker := NewTracker()
	ws := tracker.GetOrCreate("ws-1")
	require.NotNil(t, ws)
	assert.Equal(t, "ws-1", ws.WorkspaceID)
	assert.Equal(t, 1, tracker.Count())

	// Same ID returns same instance
	ws2 := tracker.GetOrCreate("ws-1")
	assert.Same(t, ws, ws2)
	assert.Equal(t, 1, tracker.Count())
}

func TestTracker_Get(t *testing.T) {
	tracker := NewTracker()

	// Not found
	_, ok := tracker.Get("nonexistent")
	assert.False(t, ok)

	// Create and find
	tracker.GetOrCreate("ws-1")
	ws, ok := tracker.Get("ws-1")
	assert.True(t, ok)
	assert.Equal(t, "ws-1", ws.WorkspaceID)
}

func TestTracker_GetSnapshot(t *testing.T) {
	tracker := NewTracker()

	// Not found
	_, ok := tracker.GetSnapshot("nonexistent")
	assert.False(t, ok)

	// Create and snapshot
	status := tracker.GetOrCreate("ws-1")
	status.SetState(StateReady, "ready")
	snap, ok := tracker.GetSnapshot("ws-1")
	assert.True(t, ok)
	assert.Equal(t, StateReady, snap.State)
}

func TestTracker_ListAll(t *testing.T) {
	tracker := NewTracker()
	tracker.GetOrCreate("ws-1").SetState(StateReady, "")
	tracker.GetOrCreate("ws-2").SetState(StateError, "")

	all := tracker.ListAll()
	assert.Len(t, all, 2)
}

func TestTracker_Remove(t *testing.T) {
	tracker := NewTracker()
	tracker.GetOrCreate("ws-1")
	assert.Equal(t, 1, tracker.Count())
	tracker.Remove("ws-1")
	assert.Equal(t, 0, tracker.Count())
	_, ok := tracker.Get("ws-1")
	assert.False(t, ok)
}

func TestTracker_CountByState(t *testing.T) {
	tracker := NewTracker()
	tracker.GetOrCreate("ws-1").SetState(StateReady, "")
	tracker.GetOrCreate("ws-2").SetState(StateReady, "")
	tracker.GetOrCreate("ws-3").SetState(StateError, "")

	counts := tracker.CountByState()
	assert.Equal(t, 2, counts[StateReady])
	assert.Equal(t, 1, counts[StateError])
}

func TestGlobal(t *testing.T) {
	tracker := Global()
	require.NotNil(t, tracker)
	// Should always return the same global instance
	assert.Same(t, tracker, Global())
}
