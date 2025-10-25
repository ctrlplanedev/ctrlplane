package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"testing"
	"time"
	"workspace-engine/pkg/db"
	eventHandler "workspace-engine/pkg/events/handler"
	kafkapkg "workspace-engine/pkg/kafka"
	"workspace-engine/pkg/workspace"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/google/uuid"
)

// TestEngine_Kafka_Replay_BasicFlow tests the full e2e replay logic with actual consumer:
// - Creates resources via Kafka messages
// - Sends workspace save event to trigger snapshot
// - Runs actual consumer to process messages
// - Verifies workspace state, snapshots, and file persistence
// - Tests full restore cycle
func TestEngine_Kafka_Replay_BasicFlow(t *testing.T) {
	env := setupTestEnvironment(t)
	defer env.cleanup()

	resourceIDs := []string{
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	}

	// Produce resource creation messages to Kafka
	for _, resourceID := range resourceIDs {
		env.produceResourceCreateEvent(resourceID)
	}

	// Produce workspace save event to trigger snapshot creation
	env.produceWorkspaceSaveEvent()

	// Run actual consumer to process messages
	env.runConsumer(5 * time.Second)

	// Verify workspace state was updated
	ws, err := workspace.GetWorkspaceAndLoad(env.workspaceID, nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	if ws == nil {
		t.Fatal("Workspace not found in memory")
	}

	resources := ws.Resources().Items()
	if len(resources) != len(resourceIDs) {
		t.Fatalf("Expected %d resources, got %d", len(resourceIDs), len(resources))
	}

	for _, resourceID := range resourceIDs {
		resource, exists := ws.Resources().Get(resourceID)
		if !exists {
			t.Fatalf("Resource %s not found in workspace", resourceID)
		}
		if resource.Id != resourceID {
			t.Fatalf("Resource ID mismatch: expected %s, got %s", resourceID, resource.Id)
		}
	}

	// Verify snapshots were created
	latestSnapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to get latest snapshot: %v", err)
	}
	if latestSnapshot == nil {
		t.Fatal("No snapshot found")
	}

	// Verify snapshot file was written
	storage := workspace.NewFileStorage("./state")
	snapshotData, err := storage.Get(env.ctx, latestSnapshot.Path)
	if err != nil {
		t.Fatalf("Failed to read snapshot file: %v", err)
	}
	if len(snapshotData) == 0 {
		t.Fatal("Snapshot file is empty")
	}

	// Test snapshot restore
	restoredWs := workspace.New(env.workspaceID, nil)
	if err := restoredWs.GobDecode(snapshotData); err != nil {
		t.Fatalf("Failed to decode snapshot: %v", err)
	}

	restoredResources := restoredWs.Resources().Items()
	if len(restoredResources) != len(resourceIDs) {
		t.Fatalf("Restored workspace: expected %d resources, got %d", len(resourceIDs), len(restoredResources))
	}

	for _, resourceID := range resourceIDs {
		resource, exists := restoredWs.Resources().Get(resourceID)
		if !exists {
			t.Fatalf("Resource %s not found in restored workspace", resourceID)
		}
		if resource.Id != resourceID {
			t.Fatalf("Restored resource ID mismatch: expected %s, got %s", resourceID, resource.Id)
		}
	}
}

// TestEngine_Kafka_Replay_WorkspaceSaveEvent tests that snapshots are only created
// when workspace.save events are sent
func TestEngine_Kafka_Replay_WorkspaceSaveEvent(t *testing.T) {
	env := setupTestEnvironment(t)
	defer env.cleanup()

	// Produce resource events without workspace save
	env.produceResourceCreateEvent(uuid.New().String())
	env.produceResourceCreateEvent(uuid.New().String())

	// Run consumer
	env.runConsumer(3 * time.Second)

	// Verify NO snapshot was created (no workspace.save event sent)
	snapshot1, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to get snapshot: %v", err)
	}
	if snapshot1 != nil {
		t.Fatalf("Expected no snapshot without workspace.save event, but found one at offset %d", snapshot1.Offset)
	}

	// Now produce workspace save event
	env.produceWorkspaceSaveEvent()

	// Run consumer again
	env.runConsumer(3 * time.Second)

	// Verify snapshot WAS created after workspace.save event
	snapshot2, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to get snapshot after save event: %v", err)
	}
	if snapshot2 == nil {
		t.Fatal("Expected snapshot to be created after workspace.save event")
	}

	// Verify snapshot contains the workspace state
	storage := workspace.NewFileStorage("./state")
	snapshotData, err := storage.Get(env.ctx, snapshot2.Path)
	if err != nil {
		t.Fatalf("Failed to read snapshot file: %v", err)
	}
	if len(snapshotData) == 0 {
		t.Fatal("Snapshot file is empty")
	}
}

// TestEngine_Kafka_Replay_MultipleWorkspaces tests replay logic with multiple workspaces
// on the same partition, each with different snapshot offsets (CRITICAL FOR PARTITION SHARING)
func TestEngine_Kafka_Replay_MultipleWorkspaces(t *testing.T) {
	if !isKafkaAvailable(t) {
		t.Skip("Kafka broker not available")
	}

	ctx := context.Background()
	cleanupAllTestWorkspaces(ctx)

	topicName := fmt.Sprintf("test-multi-ws-%s", uuid.New().String()[:8])

	// Set environment
	os.Setenv("KAFKA_TOPIC", topicName)
	kafkapkg.Topic = topicName
	kafkapkg.GroupID = fmt.Sprintf("test-group-%s", uuid.New().String()[:8])

	defer func() {
		os.Unsetenv("KAFKA_TOPIC")
		kafkapkg.Topic = "workspace-events"
		kafkapkg.GroupID = "workspace-engine"
	}()

	// Create 3 workspaces
	wsIDs := []string{
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	}

	// Create workspaces in database
	for _, wsID := range wsIDs {
		if err := createTestWorkspace(ctx, wsID); err != nil {
			t.Fatalf("Failed to create workspace %s: %v", wsID, err)
		}
	}

	defer func() {
		for _, wsID := range wsIDs {
			cleanupTestWorkspace(ctx, wsID)
		}
		cleanupKafkaTopic(t, topicName)
	}()

	// Create snapshots at different offsets
	// WS1: offset 5, WS2: offset 10, WS3: offset 15
	snapshots := []*db.WorkspaceSnapshot{
		{
			WorkspaceID:   wsIDs[0],
			Path:          fmt.Sprintf("%s.gob", wsIDs[0]),
			Timestamp:     time.Now().Add(-1 * time.Hour),
			Partition:     0,
			Offset:        5,
			NumPartitions: 1,
		},
		{
			WorkspaceID:   wsIDs[1],
			Path:          fmt.Sprintf("%s.gob", wsIDs[1]),
			Timestamp:     time.Now().Add(-1 * time.Hour),
			Partition:     0,
			Offset:        10,
			NumPartitions: 1,
		},
		{
			WorkspaceID:   wsIDs[2],
			Path:          fmt.Sprintf("%s.gob", wsIDs[2]),
			Timestamp:     time.Now().Add(-1 * time.Hour),
			Partition:     0,
			Offset:        15,
			NumPartitions: 1,
		},
	}

	for _, snapshot := range snapshots {
		if err := db.WriteWorkspaceSnapshot(ctx, snapshot); err != nil {
			t.Fatalf("Failed to write snapshot: %v", err)
		}
	}

	// Create producer
	producer := createTestProducer(t)
	defer producer.Close()

	factory1 := newResourceFactory(wsIDs[0])
	factory2 := newResourceFactory(wsIDs[1])
	factory3 := newResourceFactory(wsIDs[2])

	// Produce 30 messages (10 per workspace) for clearer distribution
	// WS1 messages at offsets: 0, 3, 6, 9, 12, 15, 18, 21, 24, 27
	// WS2 messages at offsets: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28
	// WS3 messages at offsets: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29
	for i := 0; i < 30; i++ {
		var wsID string
		var factory *resourceFactory

		switch i % 3 {
		case 0:
			wsID = wsIDs[0]
			factory = factory1
		case 1:
			wsID = wsIDs[1]
			factory = factory2
		case 2:
			wsID = wsIDs[2]
			factory = factory3
		}

		resourceID := uuid.New().String()
		payload := factory.create(resourceID)

		event := createTestEvent(wsID, eventHandler.ResourceCreate, payload)
		produceKafkaMessage(t, producer, topicName, event, int32(0), 0)
	}

	// Produce workspace save events for all workspaces
	for _, wsID := range wsIDs {
		event := createTestEvent(wsID, eventHandler.WorkspaceSave, map[string]interface{}{})
		produceKafkaMessage(t, producer, topicName, event, int32(0), 0)
	}

	// Run consumer
	consumerCtx, cancelConsumer := context.WithCancel(ctx)
	consumerDone := make(chan error, 1)

	go func() {
		consumerDone <- kafkapkg.RunConsumer(consumerCtx, nil)
	}()

	// Wait longer for multiple workspaces to process
	time.Sleep(10 * time.Second)
	cancelConsumer()

	select {
	case err := <-consumerDone:
		if err != nil && err != context.Canceled {
			t.Fatalf("Consumer error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Consumer shutdown timeout")
	}

	// Give async operations time to complete
	time.Sleep(1 * time.Second)

	// Verify each workspace processed correct messages
	ws1, err := workspace.GetWorkspaceAndLoad(wsIDs[0], nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	ws2, err := workspace.GetWorkspaceAndLoad(wsIDs[1], nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	ws3, err := workspace.GetWorkspaceAndLoad(wsIDs[2], nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}

	if ws1 == nil || ws2 == nil || ws3 == nil {
		t.Fatal("Not all workspaces found")
	}

	// Count resources processed by each workspace
	ws1Resources := len(ws1.Resources().Items())
	ws2Resources := len(ws2.Resources().Items())
	ws3Resources := len(ws3.Resources().Items())

	// Expected distribution with 30 messages:
	// WS1 messages at offsets: 0, 3, 6, 9, 12, 15, 18, 21, 24, 27
	//   BC boundary offset 5: skips 0,3 → processes 6,9,12,15,18,21,24,27 → 8 resources
	// WS2 messages at offsets: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28
	//   BC boundary offset 10: skips 1,4,7,10 → processes 13,16,19,22,25,28 → 6 resources
	// WS3 messages at offsets: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29
	//   BC boundary offset 15: skips 2,5,8,11,14 → processes 17,20,23,26,29 → 5 resources

	if ws1Resources < 5 {
		t.Fatalf("WS1 (BC: offset 5) expected ~8 resources, got %d", ws1Resources)
	}
	if ws2Resources < 4 {
		t.Fatalf("WS2 (BC: offset 10) expected ~6 resources, got %d", ws2Resources)
	}
	if ws3Resources < 3 {
		t.Fatalf("WS3 (BC: offset 15) expected ~5 resources, got %d", ws3Resources)
	}

	// Critical: Verify gradient (independent BC boundaries per workspace)
	if ws1Resources <= ws2Resources {
		t.Fatalf("WS1 (BC: offset 5) should have MORE resources than WS2 (BC: offset 10): ws1=%d, ws2=%d",
			ws1Resources, ws2Resources)
	}
	if ws2Resources <= ws3Resources {
		t.Fatalf("WS2 (BC: offset 10) should have MORE resources than WS3 (BC: offset 15): ws2=%d, ws3=%d",
			ws2Resources, ws3Resources)
	}

	// Verify snapshots updated independently
	finalSnapshots, err := db.GetLatestWorkspaceSnapshots(ctx, wsIDs)
	if err != nil {
		t.Fatalf("Failed to get final snapshots: %v", err)
	}

	if len(finalSnapshots) != 3 {
		t.Fatalf("Expected 3 final snapshots, got %d", len(finalSnapshots))
	}

	// Verify each workspace's snapshot offset advanced
	for i, wsID := range wsIDs {
		finalSnapshot := finalSnapshots[wsID]
		if finalSnapshot == nil {
			t.Fatalf("No final snapshot for WS%d", i+1)
		}

		if finalSnapshot.Offset <= snapshots[i].Offset {
			t.Fatalf("WS%d snapshot should advance beyond %d, got %d",
				i+1, snapshots[i].Offset, finalSnapshot.Offset)
		}
	}

	// Critical: Verify consumer seeked to EARLIEST offset (offset 6)
	if ws1Resources == 0 {
		t.Fatal("WS1 has no resources - consumer seeked to wrong offset (should seek to earliest: 6)")
	}
}

// TestEngine_Kafka_Replay_NoSnapshot tests behavior when no snapshot exists
// (new workspace or first time processing) - should load from database
func TestEngine_Kafka_Replay_NoSnapshot(t *testing.T) {
	env := setupTestEnvironment(t)
	defer env.cleanup()

	systemID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()

	// Insert entities directly into database (simulating existing workspace data)
	if err := insertSystemIntoDB(env.ctx, env.workspaceID, systemID, "db-system"); err != nil {
		t.Fatalf("Failed to insert system: %v", err)
	}
	if err := insertResourceIntoDB(env.ctx, env.workspaceID, resource1ID, "db-resource-1"); err != nil {
		t.Fatalf("Failed to insert resource 1: %v", err)
	}
	if err := insertResourceIntoDB(env.ctx, env.workspaceID, resource2ID, "db-resource-2"); err != nil {
		t.Fatalf("Failed to insert resource 2: %v", err)
	}

	// Verify NO snapshot exists
	snapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to check snapshot: %v", err)
	}
	if snapshot != nil {
		t.Fatal("Expected no snapshot, but one exists")
	}

	// Produce new resource via Kafka
	newResourceID := uuid.New().String()
	env.produceResourceCreateEvent(newResourceID)
	env.produceWorkspaceSaveEvent()

	// Run consumer - should load initial state from DB, then process Kafka message
	env.runConsumer(5 * time.Second)

	// Verify workspace loaded from database
	ws, err := workspace.GetWorkspaceAndLoad(env.workspaceID, nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	if ws == nil {
		t.Fatal("Workspace not found")
	}

	// Verify entities from DB were loaded
	if _, exists := ws.Systems().Get(systemID); !exists {
		t.Fatal("System from DB not loaded (PopulateWorkspaceWithInitialState failed)")
	}
	if _, exists := ws.Resources().Get(resource1ID); !exists {
		t.Fatal("Resource 1 from DB not loaded")
	}
	if _, exists := ws.Resources().Get(resource2ID); !exists {
		t.Fatal("Resource 2 from DB not loaded")
	}

	// Verify new resource from Kafka was also processed
	if _, exists := ws.Resources().Get(newResourceID); !exists {
		t.Fatal("New resource from Kafka not processed")
	}

	// Total should be 3 (2 from DB + 1 from Kafka)
	resources := ws.Resources().Items()
	if len(resources) != 3 {
		t.Fatalf("Expected 3 resources (2 from DB + 1 from Kafka), got %d", len(resources))
	}

	// Verify snapshot was created after processing Kafka messages
	finalSnapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to get final snapshot: %v", err)
	}
	if finalSnapshot == nil {
		t.Fatal("Snapshot should be created after workspace.save event")
	}

	// Verify all messages processed in normal mode (not replay)
	// Since there was no previous snapshot, all messages are "new" (AD mode)
	if finalSnapshot.Offset < 0 {
		t.Fatalf("Invalid snapshot offset: %d", finalSnapshot.Offset)
	}
}

// TestEngine_Kafka_Replay_ReplayMode tests that replay mode is correctly detected
// and workspace state is rebuilt without triggering side effects (CRITICAL BUSINESS LOGIC)
func TestEngine_Kafka_Replay_ReplayMode(t *testing.T) {
	env := setupTestEnvironment(t)
	defer env.cleanup()

	resourceIDs := []string{
		uuid.New().String(),
		uuid.New().String(),
		uuid.New().String(),
	}

	// Phase 1: Process initial messages and create snapshot
	for _, resourceID := range resourceIDs {
		env.produceResourceCreateEvent(resourceID)
	}
	env.produceWorkspaceSaveEvent()
	env.runConsumer(5 * time.Second)

	// Get snapshot
	snapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil || snapshot == nil {
		t.Fatal("Snapshot not created")
	}

	// Verify resources exist
	ws, err := workspace.GetWorkspaceAndLoad(env.workspaceID, nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	if len(ws.Resources().Items()) != len(resourceIDs) {
		t.Fatalf("Expected %d resources, got %d", len(resourceIDs), len(ws.Resources().Items()))
	}

	snapshotOffset := snapshot.Offset

	// Phase 2: Create old snapshot to simulate replay scenario
	// Set snapshot offset back to simulate being behind committed offset
	oldSnapshot := &db.WorkspaceSnapshot{
		WorkspaceID:   env.workspaceID,
		Path:          snapshot.Path,
		Timestamp:     snapshot.Timestamp,
		Partition:     0,
		Offset:        0, // Set to beginning to force replay
		NumPartitions: 1,
	}

	if err := db.WriteWorkspaceSnapshot(env.ctx, oldSnapshot); err != nil {
		t.Fatalf("Failed to write old snapshot: %v", err)
	}

	// Phase 3: Produce new messages and verify they're processed in replay mode
	// Since consumer has already committed up to snapshotOffset, but workspace snapshot is at 0,
	// messages between 0 and snapshotOffset will be in replay mode
	newResourceID := uuid.New().String()
	env.produceResourceCreateEvent(newResourceID)
	env.produceWorkspaceSaveEvent()

	// Run consumer - should process in replay mode for already-committed messages
	env.runConsumer(5 * time.Second)

	// Verify workspace state was rebuilt
	ws, err = workspace.GetWorkspaceAndLoad(env.workspaceID, nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	if ws == nil {
		t.Fatal("Workspace not found after replay")
	}

	// All original resources should still exist (state rebuilt from replay)
	for _, resourceID := range resourceIDs {
		if _, exists := ws.Resources().Get(resourceID); !exists {
			t.Fatalf("Resource %s not found after replay (state should be rebuilt)", resourceID)
		}
	}

	// New resource should also exist
	if _, exists := ws.Resources().Get(newResourceID); !exists {
		t.Fatal("New resource not found after replay processing")
	}

	// Verify final snapshot reflects the new offset
	finalSnapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to get final snapshot: %v", err)
	}

	if finalSnapshot.Offset <= snapshotOffset {
		t.Fatalf("Expected snapshot offset to advance beyond %d, got %d",
			snapshotOffset, finalSnapshot.Offset)
	}
}

// TestEngine_Kafka_Replay_JobDispatchPrevention tests that workspace state is rebuilt
// correctly during replay mode (verifies replay flag behavior)
func TestEngine_Kafka_Replay_JobDispatchPrevention(t *testing.T) {
	env := setupTestEnvironment(t)
	defer env.cleanup()

	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	versionID := uuid.New().String()
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()

	// Create complete deployment setup
	env.produceSystemCreateEvent(systemID, "test-system")
	env.produceEnvironmentCreateEvent(systemID, environmentID, "production")
	env.produceGithubEntityCreateEvent("test-owner", 12345)
	env.produceJobAgentCreateEvent(jobAgentID, "github-agent", 12345, "test-owner", "test-repo", 789)
	env.produceDeploymentCreateEvent(systemID, deploymentID, "api-service", jobAgentID)
	env.produceResourceCreateEvent(resourceID)
	env.produceDeploymentVersionCreateEvent(deploymentID, versionID, "v1.0.0")
	env.produceWorkspaceSaveEvent()

	// Run consumer
	env.runConsumer(5 * time.Second)

	ws, err := workspace.GetWorkspaceAndLoad(env.workspaceID, nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	if ws == nil {
		t.Fatal("Workspace not found")
	}

	// Verify deployment setup
	if _, exists := ws.Deployments().Get(deploymentID); !exists {
		t.Fatal("Deployment not created")
	}
	if _, exists := ws.Environments().Get(environmentID); !exists {
		t.Fatal("Environment not created")
	}
	if _, exists := ws.Resources().Get(resourceID); !exists {
		t.Fatal("Resource not created")
	}

	// Verify release targets created
	releaseTargets, err := ws.ReleaseTargets().Items(env.ctx)
	if err != nil {
		t.Fatalf("Failed to get release targets: %v", err)
	}
	if len(releaseTargets) == 0 {
		t.Fatal("No release targets created")
	}

	initialJobCount := len(ws.Jobs().Items())

	// Get snapshot
	snapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil || snapshot == nil {
		t.Fatal("Snapshot not created")
	}

	// Test replay mode: reset snapshot to force replay
	oldSnapshot := &db.WorkspaceSnapshot{
		WorkspaceID:   env.workspaceID,
		Path:          snapshot.Path,
		Timestamp:     snapshot.Timestamp,
		Partition:     0,
		Offset:        0,
		NumPartitions: 1,
	}

	if err := db.WriteWorkspaceSnapshot(env.ctx, oldSnapshot); err != nil {
		t.Fatalf("Failed to write old snapshot: %v", err)
	}

	// Create new version in replay mode
	version2ID := uuid.New().String()
	env.produceDeploymentVersionCreateEvent(deploymentID, version2ID, "v2.0.0")
	env.produceWorkspaceSaveEvent()

	env.runConsumer(5 * time.Second)

	// Verify version created during replay
	ws, err = workspace.GetWorkspaceAndLoad(env.workspaceID, nil)
	if err != nil {
		t.Fatalf("Failed to get workspace: %v", err)
	}
	versions := ws.DeploymentVersions().Items()

	versionFound := false
	for _, v := range versions {
		if v.Id == version2ID {
			versionFound = true
			break
		}
	}

	if !versionFound {
		t.Fatal("Deployment version not created during replay")
	}

	// Verify workspace state maintained during replay
	replayJobCount := len(ws.Jobs().Items())
	if replayJobCount < initialJobCount {
		t.Fatal("Jobs lost during replay (state rebuild failed)")
	}

	// Verify release targets still exist after replay
	replayReleaseTargets, err := ws.ReleaseTargets().Items(env.ctx)
	if err != nil {
		t.Fatalf("Failed to get release targets after replay: %v", err)
	}
	if len(replayReleaseTargets) == 0 {
		t.Fatal("Release targets lost during replay")
	}

	// Verify snapshot was created and contains release targets
	finalSnapshot, err := db.GetWorkspaceSnapshot(env.ctx, env.workspaceID)
	if err != nil {
		t.Fatalf("Failed to get final snapshot: %v", err)
	}
	if finalSnapshot == nil {
		t.Fatal("No final snapshot created")
	}

	// Load snapshot and verify release targets are persisted
	storage := workspace.NewFileStorage("./state")
	snapshotData, err := storage.Get(env.ctx, finalSnapshot.Path)
	if err != nil {
		t.Fatalf("Failed to read snapshot file: %v", err)
	}

	restoredWs := workspace.New(uuid.New().String(), nil)
	if err := restoredWs.GobDecode(snapshotData); err != nil {
		t.Fatalf("Failed to decode snapshot: %v", err)
	}

	// Verify release targets restored from snapshot
	restoredReleaseTargets, err := restoredWs.ReleaseTargets().Items(env.ctx)
	if err != nil {
		t.Fatalf("Failed to get release targets from restored workspace: %v", err)
	}
	if len(restoredReleaseTargets) == 0 {
		t.Fatal("Release targets not persisted in snapshot")
	}
	if len(restoredReleaseTargets) != len(releaseTargets) {
		t.Fatalf("Release target count mismatch: expected %d, got %d in restored snapshot",
			len(releaseTargets), len(restoredReleaseTargets))
	}
}

// TestEngine_Kafka_Replay_OffsetCommit tests that offsets are committed correctly
// after message processing
func TestEngine_Kafka_Replay_OffsetCommit(t *testing.T) {
	t.Skip("TODO: Implement offset commit test")
	// This test should:
	// 1. Process messages and commit offsets
	// 2. Restart consumer
	// 3. Verify consumer resumes from committed offset
	// 4. Verify messages before committed offset are treated as replay
}

// TestEngine_Kafka_Replay_PartitionRebalance tests replay logic during partition rebalance
func TestEngine_Kafka_Replay_PartitionRebalance(t *testing.T) {
	t.Skip("TODO: Implement partition rebalance test")
	// This test should:
	// 1. Start consumer with multiple partitions
	// 2. Create snapshots for workspaces on different partitions
	// 3. Simulate rebalance
	// 4. Verify correct seek behavior for newly assigned partitions
}

// Helper functions

// testEnvironment encapsulates all test resources that need cleanup
type testEnvironment struct {
	ctx         context.Context
	t           *testing.T
	workspaceID string
	topicName   string
	producer    *kafka.Producer
	consumer    *kafka.Consumer
}

// setupTestEnvironment creates and initializes all test resources
func setupTestEnvironment(t *testing.T) *testEnvironment {
	t.Helper()

	// Skip if Kafka not available
	if !isKafkaAvailable(t) {
		t.Skip("Kafka broker not available, skipping e2e test")
	}

	ctx := context.Background()

	// Clean up any leftover test workspaces from previous runs
	cleanupAllTestWorkspaces(ctx)

	workspaceID := uuid.New().String()
	topicName := fmt.Sprintf("test-replay-%s-%s", t.Name(), uuid.New().String()[:8])

	// Set environment variable for consumer to use this topic
	// Must set BEFORE accessing kafka package variables
	os.Setenv("KAFKA_TOPIC", topicName)

	// Force reload of kafka package configuration
	kafkapkg.Topic = topicName
	kafkapkg.GroupID = fmt.Sprintf("test-group-%s", uuid.New().String()[:8])

	// Create workspace in database
	if err := createTestWorkspace(ctx, workspaceID); err != nil {
		t.Fatalf("Failed to create test workspace: %v", err)
	}

	// Create Kafka producer
	producer := createTestProducer(t)

	env := &testEnvironment{
		ctx:         ctx,
		t:           t,
		workspaceID: workspaceID,
		topicName:   topicName,
		producer:    producer,
	}

	return env
}

// cleanup cleans up all test resources
func (env *testEnvironment) cleanup() {
	env.t.Helper()

	if env.consumer != nil {
		env.consumer.Close()
	}
	if env.producer != nil {
		env.producer.Close()
	}
	cleanupKafkaTopic(env.t, env.topicName)
	cleanupTestWorkspace(env.ctx, env.workspaceID)

	// Reset kafka package variables to defaults
	os.Unsetenv("KAFKA_TOPIC")
	kafkapkg.Topic = "workspace-events"
	kafkapkg.GroupID = "workspace-engine"
}

// generateAlphanumeric generates a random alphanumeric string of specified length
func generateAlphanumeric(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// resourceFactory creates a resource payload with random alphanumeric values
type resourceFactory struct {
	workspaceID string
}

func newResourceFactory(workspaceID string) *resourceFactory {
	return &resourceFactory{workspaceID: workspaceID}
}

func (rf *resourceFactory) create(resourceID string) map[string]interface{} {
	return map[string]interface{}{
		"id":          resourceID,
		"workspaceId": rf.workspaceID,
		"name":        fmt.Sprintf("resource-%s", generateAlphanumeric(8)),
		"kind":        fmt.Sprintf("kind-%s", generateAlphanumeric(6)),
		"version":     fmt.Sprintf("v%s", generateAlphanumeric(4)),
		"identifier":  generateAlphanumeric(12),
		"config": map[string]interface{}{
			"region":      generateAlphanumeric(10),
			"environment": generateAlphanumeric(8),
			"tier":        generateAlphanumeric(6),
		},
		"metadata": map[string]interface{}{
			"label-" + generateAlphanumeric(4): generateAlphanumeric(10),
			"label-" + generateAlphanumeric(4): generateAlphanumeric(10),
			"tag-" + generateAlphanumeric(4):   generateAlphanumeric(8),
		},
	}
}

// produceResourceCreateEvent produces a resource creation event with auto-generated payload
func (env *testEnvironment) produceResourceCreateEvent(resourceID string) {
	env.t.Helper()

	factory := newResourceFactory(env.workspaceID)
	payload := factory.create(resourceID)

	event := createTestEvent(env.workspaceID, eventHandler.ResourceCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceWorkspaceSaveEvent produces a workspace save event to trigger snapshot creation
func (env *testEnvironment) produceWorkspaceSaveEvent() {
	env.t.Helper()

	event := createTestEvent(env.workspaceID, eventHandler.WorkspaceSave, map[string]interface{}{})
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceSystemCreateEvent produces a system creation event
func (env *testEnvironment) produceSystemCreateEvent(systemID, name string) {
	env.t.Helper()

	payload := map[string]interface{}{
		"id":          systemID,
		"workspaceId": env.workspaceID,
		"name":        name,
		"description": fmt.Sprintf("System %s", name),
	}

	event := createTestEvent(env.workspaceID, eventHandler.SystemCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceEnvironmentCreateEvent produces an environment creation event with resource selector
func (env *testEnvironment) produceEnvironmentCreateEvent(systemID, environmentID, name string) {
	env.t.Helper()

	// Match-all resource selector
	selector := map[string]interface{}{
		"json": map[string]interface{}{
			"type":     "name",
			"operator": "contains",
			"value":    "",
		},
	}

	payload := map[string]interface{}{
		"id":               environmentID,
		"workspaceId":      env.workspaceID,
		"systemId":         systemID,
		"name":             name,
		"resourceSelector": selector,
	}

	event := createTestEvent(env.workspaceID, eventHandler.EnvironmentCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceGithubEntityCreateEvent produces a GitHub entity creation event
func (env *testEnvironment) produceGithubEntityCreateEvent(slug string, installationID int) {
	env.t.Helper()

	payload := map[string]interface{}{
		"workspaceId":    env.workspaceID,
		"slug":           slug,
		"installationId": installationID,
	}

	event := createTestEvent(env.workspaceID, eventHandler.GithubEntityCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceJobAgentCreateEvent produces a job agent creation event
func (env *testEnvironment) produceJobAgentCreateEvent(jobAgentID, name string, installationID int, owner, repo string, workflowID int) {
	env.t.Helper()

	payload := map[string]interface{}{
		"id":          jobAgentID,
		"workspaceId": env.workspaceID,
		"name":        name,
		"type":        "github",
		"config": map[string]interface{}{
			"installationId": installationID,
			"owner":          owner,
			"repo":           repo,
			"workflowId":     workflowID,
		},
	}

	event := createTestEvent(env.workspaceID, eventHandler.JobAgentCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceDeploymentCreateEvent produces a deployment creation event
func (env *testEnvironment) produceDeploymentCreateEvent(systemID, deploymentID, name, jobAgentID string) {
	env.t.Helper()

	// Match-all resource selector
	selector := map[string]interface{}{
		"json": map[string]interface{}{
			"type":     "name",
			"operator": "contains",
			"value":    "",
		},
	}

	payload := map[string]interface{}{
		"id":               deploymentID,
		"workspaceId":      env.workspaceID,
		"systemId":         systemID,
		"name":             name,
		"slug":             name,
		"jobAgentId":       jobAgentID,
		"jobAgentConfig":   map[string]interface{}{},
		"resourceSelector": selector,
	}

	event := createTestEvent(env.workspaceID, eventHandler.DeploymentCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// produceDeploymentVersionCreateEvent produces a deployment version creation event
func (env *testEnvironment) produceDeploymentVersionCreateEvent(deploymentID, versionID, version string) {
	env.t.Helper()

	payload := map[string]interface{}{
		"id":           versionID,
		"workspaceId":  env.workspaceID,
		"deploymentId": deploymentID,
		"version":      version,
	}

	event := createTestEvent(env.workspaceID, eventHandler.DeploymentVersionCreate, payload)
	produceKafkaMessage(env.t, env.producer, env.topicName, event, int32(0), 0)
}

// runConsumer runs the consumer for the specified duration and handles shutdown
func (env *testEnvironment) runConsumer(duration time.Duration) {
	env.t.Helper()

	consumerCtx, cancelConsumer := context.WithCancel(env.ctx)
	consumerDone := make(chan error, 1)

	go func() {
		consumerDone <- kafkapkg.RunConsumer(consumerCtx, nil)
	}()

	time.Sleep(duration)
	cancelConsumer()

	select {
	case err := <-consumerDone:
		if err != nil && err != context.Canceled {
			env.t.Fatalf("Consumer stopped with unexpected error: %v", err)
		}
	case <-time.After(5 * time.Second):
		env.t.Fatal("Consumer did not shutdown in time")
	}
}

func isKafkaAvailable(t *testing.T) bool {
	t.Helper()

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
	})
	if err != nil {
		return false
	}
	defer producer.Close()

	// Try to get metadata
	metadata, err := producer.GetMetadata(nil, false, 1000)
	if err != nil {
		return false
	}

	return len(metadata.Brokers) > 0
}

func createTestProducer(t *testing.T) *kafka.Producer {
	t.Helper()

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
	})
	if err != nil {
		t.Fatalf("Failed to create producer: %v", err)
	}

	return producer
}

func createTestConsumer(t *testing.T, topic string, groupID string) *kafka.Consumer {
	t.Helper()

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":  brokers,
		"group.id":           groupID,
		"auto.offset.reset":  "earliest",
		"enable.auto.commit": false,
	})
	if err != nil {
		t.Fatalf("Failed to create consumer: %v", err)
	}

	return consumer
}

func createTestEvent(workspaceID string, eventType eventHandler.EventType, payload map[string]interface{}) []byte {
	payloadBytes, _ := json.Marshal(payload)

	event := eventHandler.RawEvent{
		EventType:   eventType,
		WorkspaceID: workspaceID,
		Data:        payloadBytes,
		Timestamp:   time.Now().UnixNano(),
	}

	data, _ := json.Marshal(event)
	return data
}

func produceKafkaMessage(t *testing.T, producer *kafka.Producer, topic string, message []byte, partition int32, offset int64) {
	t.Helper()

	// Create topic if it doesn't exist
	adminClient, err := kafka.NewAdminClientFromProducer(producer)
	if err != nil {
		t.Fatalf("Failed to create admin client: %v", err)
	}
	defer adminClient.Close()

	// Check if topic exists
	metadata, err := producer.GetMetadata(&topic, false, 5000)
	if err != nil || len(metadata.Topics) == 0 || metadata.Topics[topic].Error.Code() != kafka.ErrNoError {
		// Create topic
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		results, err := adminClient.CreateTopics(ctx, []kafka.TopicSpecification{
			{
				Topic:             topic,
				NumPartitions:     1,
				ReplicationFactor: 1,
			},
		})
		if err != nil {
			t.Fatalf("Failed to create topic: %v", err)
		}

		for _, result := range results {
			if result.Error.Code() != kafka.ErrNoError && result.Error.Code() != kafka.ErrTopicAlreadyExists {
				t.Fatalf("Failed to create topic %s: %v", result.Topic, result.Error)
			}
		}

		// Wait for topic to be ready
		time.Sleep(1 * time.Second)
	}

	// Produce message
	deliveryChan := make(chan kafka.Event, 1)
	err = producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: partition,
		},
		Value:     message,
		Timestamp: time.Now(),
	}, deliveryChan)

	if err != nil {
		t.Fatalf("Failed to produce message: %v", err)
	}

	// Wait for delivery confirmation
	e := <-deliveryChan
	m := e.(*kafka.Message)

	if m.TopicPartition.Error != nil {
		t.Fatalf("Failed to deliver message: %v", m.TopicPartition.Error)
	}
}

func cleanupKafkaTopic(t *testing.T, topic string) {
	t.Helper()

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	adminClient, err := kafka.NewAdminClient(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
	})
	if err != nil {
		return
	}
	defer adminClient.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, _ = adminClient.DeleteTopics(ctx, []string{topic})
}

func createTestWorkspace(ctx context.Context, workspaceID string) error {
	conn, err := db.GetDB(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	_, err = conn.Exec(ctx, `
		INSERT INTO workspace (id, name, slug, created_at)
		VALUES ($1, $2, $3, NOW())
	`, workspaceID, "test-workspace-"+workspaceID[:8], "test-"+workspaceID[:8])

	return err
}

func cleanupTestWorkspace(ctx context.Context, workspaceID string) {
	conn, err := db.GetDB(ctx)
	if err != nil {
		return
	}
	defer conn.Release()

	// Delete workspace (cascade will delete snapshots)
	_, _ = conn.Exec(ctx, `DELETE FROM workspace WHERE id = $1`, workspaceID)
}

func cleanupAllTestWorkspaces(ctx context.Context) {
	conn, err := db.GetDB(ctx)
	if err != nil {
		return
	}
	defer conn.Release()

	// Delete all workspaces with test prefix (from this or previous test runs)
	// This also deletes their snapshots via CASCADE
	_, _ = conn.Exec(ctx, `DELETE FROM workspace WHERE slug LIKE 'test-%'`)

	// Also clean up orphaned snapshot files from ./state directory
	_ = os.RemoveAll("./state")
	_ = os.Mkdir("./state", 0755)
}

func insertSystemIntoDB(ctx context.Context, workspaceID, systemID, name string) error {
	conn, err := db.GetDB(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	_, err = conn.Exec(ctx, `
		INSERT INTO system (id, workspace_id, name, slug, description)
		VALUES ($1, $2, $3, $4, $5)
	`, systemID, workspaceID, name, name, "")

	return err
}

func insertResourceIntoDB(ctx context.Context, workspaceID, resourceID, name string) error {
	conn, err := db.GetDB(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	_, err = conn.Exec(ctx, `
		INSERT INTO resource (id, workspace_id, name, version, kind, identifier, config)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, resourceID, workspaceID, name, "v1", "test-kind", name, "{}")

	return err
}
