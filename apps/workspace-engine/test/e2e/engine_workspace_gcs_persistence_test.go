package e2e

// These tests validate GCS storage persistence
// They automatically configure WORKSPACE_STATES_BUCKET_URL to gs://ctrlplane/workspace-states-testing
// They require proper GCP authentication (gcloud auth application-default login --project=wandb-ctrlplane)
// Helper functions are in engine_workspace_persistence_helpers_test.go

// func setupGCSTest(t *testing.T, ctx context.Context) workspace.StorageClient {
// 	t.Helper()

// 	// Set the GCS bucket URL for this test (automatically restored after test)
// 	t.Setenv("WORKSPACE_STATES_BUCKET_URL", "gs://ctrlplane/workspace-states-testing")

// 	// Create GCS storage client
// 	storage, err := workspace.NewGCSStorageClient(ctx)
// 	if err != nil {
// 		t.Fatalf("failed to create GCS storage client: %v\nMake sure you're authenticated: gcloud auth application-default login --project=wandb-ctrlplane", err)
// 	}
// 	return storage
// }

// // cleanupGCSFile deletes a test file from GCS
// func cleanupGCSFile(t *testing.T, ctx context.Context, storage workspace.StorageClient, path string) {
// 	t.Helper()

// 	// Type assert to GCSStorageClient to access Delete method
// 	gcsStorage, ok := storage.(*workspace.GCSStorageClient)
// 	if !ok {
// 		t.Logf("Warning: storage is not GCSStorageClient, cannot cleanup file: %s", path)
// 		return
// 	}

// 	if err := gcsStorage.Delete(ctx, path); err != nil {
// 		t.Logf("Warning: failed to cleanup GCS file %s: %v", path, err)
// 	}
// }

// func TestEngine_GCS_BasicSaveLoadRoundtrip(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	resource1Id := uuid.New().String()
// 	resource2Id := uuid.New().String()
// 	systemId := uuid.New().String()
// 	jobAgentId := uuid.New().String()
// 	deploymentId := uuid.New().String()

// 	// Create workspace and populate using integration helpers
// 	engine := integration.NewTestWorkspace(t,
// 		integration.WithResource(
// 			integration.ResourceID(resource1Id),
// 			integration.ResourceName("gcs-resource-1"),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resource2Id),
// 			integration.ResourceName("gcs-resource-2"),
// 		),
// 		integration.WithJobAgent(
// 			integration.JobAgentID(jobAgentId),
// 			integration.JobAgentName("gcs-job-agent"),
// 		),
// 		integration.WithSystem(
// 			integration.SystemID(systemId),
// 			integration.SystemName("gcs-test-system"),
// 			integration.WithDeployment(
// 				integration.DeploymentID(deploymentId),
// 				integration.DeploymentName("gcs-deployment"),
// 				integration.DeploymentJobAgent(jobAgentId),
// 			),
// 		),
// 	)

// 	ws := engine.Workspace()
// 	workspaceID := ws.ID

// 	// Capture original state
// 	originalResources := ws.Resources().Items()
// 	originalDeployments := ws.Deployments().Items()
// 	originalSystems := ws.Systems().Items()
// 	originalJobAgents := ws.JobAgents().Items()

// 	// Encode workspace
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	// Write to GCS
// 	testPath := fmt.Sprintf("test-roundtrip-%s.gob", uuid.New().String())
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Create a new workspace and load from GCS
// 	newWs := workspace.New(workspaceID)

// 	// Read from GCS
// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from GCS: %v", err)
// 	}

// 	// Decode workspace
// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify workspace ID
// 	if newWs.ID != workspaceID {
// 		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
// 	}

// 	// Verify all resources with full field comparison
// 	loadedResources := newWs.Resources().Items()
// 	if len(loadedResources) != len(originalResources) {
// 		t.Errorf("resources count mismatch: expected %d, got %d", len(originalResources), len(loadedResources))
// 	}
// 	for id, original := range originalResources {
// 		loaded, ok := loadedResources[id]
// 		if !ok {
// 			t.Errorf("resource %s not found after load from GCS", id)
// 			continue
// 		}
// 		verifyResourcesEqual(t, original, loaded, "resource "+id)
// 	}

// 	// Verify all deployments
// 	loadedDeployments := newWs.Deployments().Items()
// 	if len(loadedDeployments) != len(originalDeployments) {
// 		t.Errorf("deployments count mismatch: expected %d, got %d", len(originalDeployments), len(loadedDeployments))
// 	}
// 	for id, original := range originalDeployments {
// 		loaded, ok := loadedDeployments[id]
// 		if !ok {
// 			t.Errorf("deployment %s not found after load from GCS", id)
// 			continue
// 		}
// 		verifyDeploymentsEqual(t, original, loaded, "deployment "+id)
// 	}

// 	// Verify all systems
// 	loadedSystems := newWs.Systems().Items()
// 	if len(loadedSystems) != len(originalSystems) {
// 		t.Errorf("systems count mismatch: expected %d, got %d", len(originalSystems), len(loadedSystems))
// 	}
// 	for id, original := range originalSystems {
// 		loaded, ok := loadedSystems[id]
// 		if !ok {
// 			t.Errorf("system %s not found after load from GCS", id)
// 			continue
// 		}
// 		verifySystemsEqual(t, original, loaded, "system "+id)
// 	}

// 	// Verify all job agents
// 	loadedJobAgents := newWs.JobAgents().Items()
// 	if len(loadedJobAgents) != len(originalJobAgents) {
// 		t.Errorf("job agents count mismatch: expected %d, got %d", len(originalJobAgents), len(loadedJobAgents))
// 	}
// 	for id, original := range originalJobAgents {
// 		loaded, ok := loadedJobAgents[id]
// 		if !ok {
// 			t.Errorf("job agent %s not found after load from GCS", id)
// 			continue
// 		}
// 		verifyJobAgentsEqual(t, original, loaded, "job agent "+id)
// 	}

// 	t.Logf("Successfully saved and loaded workspace to/from GCS at path: %s", testPath)
// }

// func TestEngine_GCS_EmptyWorkspace(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	// Create empty workspace
// 	workspaceID := uuid.New().String()
// 	ws := workspace.NewNoFlush(workspaceID)

// 	// Encode workspace
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	// Write to GCS
// 	testPath := fmt.Sprintf("test-empty-%s.gob", uuid.New().String())
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write empty workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Load into new workspace
// 	newWs := workspace.NewNoFlush("temp")

// 	// Read from GCS
// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from GCS: %v", err)
// 	}

// 	// Decode workspace
// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify it's still empty
// 	if newWs.ID != workspaceID {
// 		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
// 	}

// 	if len(newWs.Resources().Items()) != 0 {
// 		t.Errorf("expected 0 resources, got %d", len(newWs.Resources().Items()))
// 	}

// 	if len(newWs.Deployments().Items()) != 0 {
// 		t.Errorf("expected 0 deployments, got %d", len(newWs.Deployments().Items()))
// 	}

// 	t.Logf("Successfully saved and loaded empty workspace to/from GCS at path: %s", testPath)
// }

// func TestEngine_GCS_ResourcesWithMetadata(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	systemId := uuid.New().String()
// 	resource1Id := uuid.New().String()
// 	resource2Id := uuid.New().String()
// 	resource3Id := uuid.New().String()

// 	// Create workspace with resources containing rich metadata
// 	engine := integration.NewTestWorkspace(t,
// 		integration.WithSystem(
// 			integration.SystemID(systemId),
// 			integration.SystemName("metadata-test-system"),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resource1Id),
// 			integration.ResourceName("server-prod-1"),
// 			integration.ResourceConfig(map[string]interface{}{
// 				"type":     "server",
// 				"cpu":      4,
// 				"memory":   16,
// 				"location": "us-west-2a",
// 			}),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resource2Id),
// 			integration.ResourceName("database-prod"),
// 			integration.ResourceConfig(map[string]interface{}{
// 				"type":        "postgresql",
// 				"version":     "15.2",
// 				"storage_gb":  500,
// 				"replicas":    3,
// 				"auto_backup": true,
// 			}),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resource3Id),
// 			integration.ResourceName("cache-cluster"),
// 			integration.ResourceConfig(map[string]interface{}{
// 				"type":      "redis",
// 				"nodes":     6,
// 				"eviction":  "allkeys-lru",
// 				"maxmemory": "8gb",
// 				"persistence": map[string]interface{}{
// 					"enabled": true,
// 					"type":    "aof",
// 				},
// 			}),
// 		),
// 	)

// 	ws := engine.Workspace()
// 	workspaceID := ws.ID

// 	// Add additional metadata to resources after creation
// 	res1, _ := ws.Resources().Get(resource1Id)
// 	res1.Metadata = map[string]string{
// 		"env":         "production",
// 		"region":      "us-west-2",
// 		"owner":       "platform-team",
// 		"cost_center": "engineering",
// 		"managed_by":  "terraform",
// 	}

// 	res2, _ := ws.Resources().Get(resource2Id)
// 	res2.Metadata = map[string]string{
// 		"env":           "production",
// 		"backup_window": "02:00-04:00",
// 		"maintenance":   "sunday-03:00",
// 		"encrypted":     "true",
// 	}

// 	res3, _ := ws.Resources().Get(resource3Id)
// 	res3.Metadata = map[string]string{
// 		"env":      "production",
// 		"cluster":  "main",
// 		"sentinel": "enabled",
// 	}

// 	// Capture original resources
// 	originalResources := ws.Resources().Items()

// 	// Encode and save to GCS
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	testPath := fmt.Sprintf("test-resource-metadata-%s.gob", uuid.New().String())
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Load from GCS
// 	newWs := workspace.New(workspaceID)

// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from GCS: %v", err)
// 	}

// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify all resources with metadata and config
// 	loadedResources := newWs.Resources().Items()
// 	if len(loadedResources) != 3 {
// 		t.Fatalf("expected 3 resources, got %d", len(loadedResources))
// 	}

// 	for id, original := range originalResources {
// 		loaded, ok := loadedResources[id]
// 		if !ok {
// 			t.Errorf("resource %s not found after GCS restore", id)
// 			continue
// 		}

// 		// Use full field verification
// 		verifyResourcesEqual(t, original, loaded, "resource "+id)
// 	}

// 	// Specific metadata checks for our test resources
// 	loadedRes1, _ := newWs.Resources().Get(resource1Id)
// 	if loadedRes1.Metadata["owner"] != "platform-team" {
// 		t.Errorf("resource 1 metadata[owner] not preserved: got %s", loadedRes1.Metadata["owner"])
// 	}
// 	if loadedRes1.Metadata["cost_center"] != "engineering" {
// 		t.Errorf("resource 1 metadata[cost_center] not preserved: got %s", loadedRes1.Metadata["cost_center"])
// 	}

// 	loadedRes2, _ := newWs.Resources().Get(resource2Id)
// 	if loadedRes2.Metadata["encrypted"] != "true" {
// 		t.Errorf("resource 2 metadata[encrypted] not preserved: got %s", loadedRes2.Metadata["encrypted"])
// 	}

// 	loadedRes3, _ := newWs.Resources().Get(resource3Id)

// 	// Verify config objects are preserved
// 	if loadedRes1.Config == nil {
// 		t.Error("resource 1 config is nil after GCS restore")
// 	}
// 	if loadedRes2.Config == nil {
// 		t.Error("resource 2 config is nil after GCS restore")
// 	}
// 	if loadedRes3.Config == nil {
// 		t.Error("resource 3 config is nil after GCS restore")
// 	}

// 	t.Logf("Successfully verified resources with metadata and config in GCS at path: %s", testPath)
// }

// func TestEngine_GCS_MultipleWorkspaces(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	// Create and save multiple different workspaces
// 	workspaceIDs := []string{uuid.New().String(), uuid.New().String(), uuid.New().String()}
// 	testPaths := make(map[string]string)

// 	for i, wsID := range workspaceIDs {
// 		ws := workspace.NewNoFlush(wsID)

// 		// Encode and save
// 		data, err := ws.GobEncode()
// 		if err != nil {
// 			t.Fatalf("failed to encode workspace %s: %v", wsID, err)
// 		}

// 		testPath := fmt.Sprintf("test-multi-%d-%s.gob", i, uuid.New().String())
// 		testPaths[wsID] = testPath

// 		if err := storage.Put(ctx, testPath, data); err != nil {
// 			t.Fatalf("failed to save workspace %s to GCS: %v", wsID, err)
// 		}
// 		defer cleanupGCSFile(t, ctx, storage, testPath)
// 	}

// 	// Load each workspace and verify they're distinct
// 	for _, wsID := range workspaceIDs {
// 		newWs := workspace.NewNoFlush("temp")

// 		testPath := testPaths[wsID]
// 		loadedData, err := storage.Get(ctx, testPath)
// 		if err != nil {
// 			t.Fatalf("failed to load workspace %s from GCS: %v", wsID, err)
// 		}

// 		if err := newWs.GobDecode(loadedData); err != nil {
// 			t.Fatalf("failed to decode workspace %s: %v", wsID, err)
// 		}

// 		// Verify workspace ID is correct
// 		if newWs.ID != wsID {
// 			t.Errorf("workspace ID mismatch: expected %s, got %s", wsID, newWs.ID)
// 		}
// 	}

// 	t.Logf("Successfully saved and loaded %d workspaces to/from GCS", len(workspaceIDs))
// }

// func TestEngine_GCS_LargeWorkspace(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	systemId := uuid.New().String()

// 	// Create workspace with many resources to test large file handling
// 	opts := []integration.WorkspaceOption{
// 		integration.WithSystem(
// 			integration.SystemID(systemId),
// 			integration.SystemName("large-system"),
// 		),
// 	}

// 	// Add 100 resources
// 	for i := 0; i < 100; i++ {
// 		resourceId := uuid.New().String()
// 		opts = append(opts, integration.WithResource(
// 			integration.ResourceID(resourceId),
// 			integration.ResourceName(fmt.Sprintf("resource-%d", i)),
// 			integration.ResourceConfig(map[string]interface{}{
// 				"index": i,
// 				"type":  "test",
// 				"data":  fmt.Sprintf("large payload data for resource %d", i),
// 			}),
// 		))
// 	}

// 	engine := integration.NewTestWorkspace(t, opts...)
// 	ws := engine.Workspace()
// 	workspaceID := ws.ID

// 	// Verify we have 100 resources
// 	originalResources := ws.Resources().Items()
// 	if len(originalResources) != 100 {
// 		t.Fatalf("expected 100 resources, got %d", len(originalResources))
// 	}

// 	// Encode workspace
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	t.Logf("Encoded workspace size: %d bytes (%.2f KB)", len(data), float64(len(data))/1024)

// 	// Write to GCS
// 	testPath := fmt.Sprintf("test-large-%s.gob", uuid.New().String())
// 	startWrite := time.Now()
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write large workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)
// 	writeDuration := time.Since(startWrite)

// 	// Load from GCS
// 	newWs := workspace.New(workspaceID)
// 	startRead := time.Now()
// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read large workspace from GCS: %v", err)
// 	}
// 	readDuration := time.Since(startRead)

// 	// Decode workspace
// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify all 100 resources are preserved
// 	loadedResources := newWs.Resources().Items()
// 	if len(loadedResources) != 100 {
// 		t.Errorf("expected 100 resources after load, got %d", len(loadedResources))
// 	}

// 	// Spot check a few resources
// 	for id, original := range originalResources {
// 		loaded, ok := loadedResources[id]
// 		if !ok {
// 			t.Errorf("resource %s not found after load from GCS", id)
// 			continue
// 		}
// 		verifyResourcesEqual(t, original, loaded, "resource "+id)
// 	}

// 	t.Logf("GCS Performance: Write=%v, Read=%v, Size=%.2fKB", writeDuration, readDuration, float64(len(data))/1024)
// }

// func TestEngine_GCS_JobsWithMetadata(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	systemId := uuid.New().String()
// 	jobAgentId := uuid.New().String()
// 	deploymentId := uuid.New().String()
// 	deploymentVersionId := uuid.New().String()
// 	envId := uuid.New().String()
// 	resourceId := uuid.New().String()

// 	// Create workspace with deployment that generates jobs
// 	engine := integration.NewTestWorkspace(t,
// 		integration.WithJobAgent(
// 			integration.JobAgentID(jobAgentId),
// 			integration.JobAgentName("gcs-test-agent"),
// 		),
// 		integration.WithSystem(
// 			integration.SystemID(systemId),
// 			integration.SystemName("gcs-test-system"),
// 			integration.WithDeployment(
// 				integration.DeploymentID(deploymentId),
// 				integration.DeploymentName("gcs-test-deployment"),
// 				integration.DeploymentJobAgent(jobAgentId),
// 				integration.WithDeploymentVersion(
// 					integration.DeploymentVersionID(deploymentVersionId),
// 					integration.DeploymentVersionTag("v1.0.0"),
// 				),
// 			),
// 			integration.WithEnvironment(
// 				integration.EnvironmentID(envId),
// 				integration.EnvironmentName("gcs-test-env"),
// 			),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resourceId),
// 			integration.ResourceName("gcs-test-resource"),
// 		),
// 	)

// 	ws := engine.Workspace()
// 	workspaceID := ws.ID

// 	// Get all jobs and update them with various metadata
// 	allJobs := ws.Jobs().Items()
// 	if len(allJobs) == 0 {
// 		t.Fatal("expected at least one job to be created")
// 	}

// 	// Add rich metadata to jobs
// 	jobsWithMetadata := make(map[string]*oapi.Job)
// 	for jobId, job := range allJobs {
// 		job.Metadata = map[string]string{
// 			"environment": "test",
// 			"region":      "us-west-2",
// 			"version":     "1.2.3",
// 			"deploy_id":   uuid.New().String(),
// 		}
// 		ws.Jobs().Upsert(ctx, job)
// 		jobsWithMetadata[jobId] = job
// 	}

// 	// Encode workspace
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	// Write to GCS
// 	testPath := fmt.Sprintf("test-jobs-metadata-%s.gob", uuid.New().String())
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Load into new workspace
// 	newWs := workspace.New(workspaceID)

// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from GCS: %v", err)
// 	}

// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify all jobs with metadata
// 	for jobId, originalJob := range jobsWithMetadata {
// 		restoredJob, ok := newWs.Jobs().Get(jobId)
// 		if !ok {
// 			t.Errorf("job %s not found after restore from GCS", jobId)
// 			continue
// 		}

// 		verifyJobsEqual(t, originalJob, restoredJob, "job "+jobId)
// 	}

// 	t.Logf("Successfully saved and loaded jobs with metadata to/from GCS at path: %s", testPath)
// }

// func TestEngine_GCS_TimestampPrecision(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	systemId := uuid.New().String()
// 	jobAgentId := uuid.New().String()
// 	deploymentId := uuid.New().String()
// 	deploymentVersionId := uuid.New().String()
// 	envId := uuid.New().String()
// 	resourceId := uuid.New().String()

// 	// Create workspace with jobs
// 	engine := integration.NewTestWorkspace(t,
// 		integration.WithJobAgent(
// 			integration.JobAgentID(jobAgentId),
// 			integration.JobAgentName("gcs-agent"),
// 		),
// 		integration.WithSystem(
// 			integration.SystemID(systemId),
// 			integration.SystemName("gcs-system"),
// 			integration.WithDeployment(
// 				integration.DeploymentID(deploymentId),
// 				integration.DeploymentName("gcs-deployment"),
// 				integration.DeploymentJobAgent(jobAgentId),
// 				integration.WithDeploymentVersion(
// 					integration.DeploymentVersionID(deploymentVersionId),
// 					integration.DeploymentVersionTag("v1.0.0"),
// 				),
// 			),
// 			integration.WithEnvironment(
// 				integration.EnvironmentID(envId),
// 				integration.EnvironmentName("gcs-env"),
// 			),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resourceId),
// 			integration.ResourceName("gcs-resource"),
// 		),
// 	)

// 	ws := engine.Workspace()
// 	workspaceID := ws.ID

// 	// Create jobs with specific timestamps including nanoseconds
// 	utcLoc := time.UTC
// 	testTimestamps := []struct {
// 		name      string
// 		createdAt time.Time
// 		updatedAt time.Time
// 		startedAt *time.Time
// 		completed *time.Time
// 	}{
// 		{
// 			name:      "utc-with-nanos",
// 			createdAt: time.Date(2023, 5, 15, 10, 30, 45, 123456789, utcLoc),
// 			updatedAt: time.Date(2023, 5, 15, 11, 30, 45, 987654321, utcLoc),
// 			startedAt: ptrTime(time.Date(2023, 5, 15, 10, 31, 0, 555555555, utcLoc)),
// 			completed: ptrTime(time.Date(2023, 5, 15, 11, 30, 0, 999999999, utcLoc)),
// 		},
// 		{
// 			name:      "far-future",
// 			createdAt: time.Date(2099, 12, 31, 23, 59, 59, 111111111, utcLoc),
// 			updatedAt: time.Date(2099, 12, 31, 23, 59, 59, 222222222, utcLoc),
// 			startedAt: nil,
// 			completed: nil,
// 		},
// 	}

// 	jobTimestamps := make(map[string]struct {
// 		createdAt time.Time
// 		updatedAt time.Time
// 		startedAt *time.Time
// 		completed *time.Time
// 	})

// 	// Create jobs with specific timestamps
// 	for _, ts := range testTimestamps {
// 		jobId := uuid.New().String()
// 		releaseId := uuid.New().String()

// 		job := &oapi.Job{
// 			Id:             jobId,
// 			Status:         oapi.Pending,
// 			JobAgentId:     jobAgentId,
// 			ReleaseId:      releaseId,
// 			CreatedAt:      ts.createdAt,
// 			UpdatedAt:      ts.updatedAt,
// 			StartedAt:      ts.startedAt,
// 			CompletedAt:    ts.completed,
// 			JobAgentConfig: make(map[string]interface{}),
// 			Metadata:       map[string]string{"test": ts.name},
// 		}

// 		ws.Jobs().Upsert(ctx, job)
// 		jobTimestamps[jobId] = struct {
// 			createdAt time.Time
// 			updatedAt time.Time
// 			startedAt *time.Time
// 			completed *time.Time
// 		}{
// 			createdAt: ts.createdAt,
// 			updatedAt: ts.updatedAt,
// 			startedAt: ts.startedAt,
// 			completed: ts.completed,
// 		}
// 	}

// 	// Encode and save to GCS
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	testPath := fmt.Sprintf("test-timestamps-%s.gob", uuid.New().String())
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Load from GCS
// 	newWs := workspace.New(workspaceID)

// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from GCS: %v", err)
// 	}

// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify all timestamps are preserved with nanosecond precision
// 	for jobId, expectedTimestamps := range jobTimestamps {
// 		restoredJob, ok := newWs.Jobs().Get(jobId)
// 		if !ok {
// 			t.Errorf("job %s not found after restore from GCS", jobId)
// 			continue
// 		}

// 		// Verify nanoseconds are preserved
// 		if restoredJob.CreatedAt.Nanosecond() != expectedTimestamps.createdAt.Nanosecond() {
// 			t.Errorf("job %s: CreatedAt nanoseconds not preserved in GCS, expected %d, got %d",
// 				jobId, expectedTimestamps.createdAt.Nanosecond(), restoredJob.CreatedAt.Nanosecond())
// 		}

// 		if restoredJob.UpdatedAt.Nanosecond() != expectedTimestamps.updatedAt.Nanosecond() {
// 			t.Errorf("job %s: UpdatedAt nanoseconds not preserved in GCS, expected %d, got %d",
// 				jobId, expectedTimestamps.updatedAt.Nanosecond(), restoredJob.UpdatedAt.Nanosecond())
// 		}
// 	}

// 	t.Logf("Successfully verified nanosecond timestamp precision in GCS at path: %s", testPath)
// }

// func TestEngine_GCS_LoadFromNonExistentFile(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	// Attempt to load from non-existent file
// 	nonExistentPath := fmt.Sprintf("non-existent-%s.gob", uuid.New().String())
// 	_, err := storage.Get(ctx, nonExistentPath)

// 	// Verify error is returned
// 	if err == nil {
// 		t.Fatal("expected error when loading from non-existent GCS file, got nil")
// 	}

// 	// Verify it's a "not found" error
// 	if !isNotFoundError(err) {
// 		t.Logf("Error message: %v", err)
// 	}

// 	t.Logf("Correctly received error for non-existent file: %v", err)
// }

// func TestEngine_GCS_OverwriteExistingFile(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	testPath := fmt.Sprintf("test-overwrite-%s.gob", uuid.New().String())
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Create first workspace
// 	workspaceID1 := uuid.New().String()
// 	ws1 := workspace.NewNoFlush(workspaceID1)

// 	data1, err := ws1.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode first workspace: %v", err)
// 	}

// 	// Write first workspace
// 	if err := storage.Put(ctx, testPath, data1); err != nil {
// 		t.Fatalf("failed to write first workspace to GCS: %v", err)
// 	}

// 	// Create second workspace with different ID
// 	workspaceID2 := uuid.New().String()
// 	ws2 := workspace.NewNoFlush(workspaceID2)

// 	data2, err := ws2.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode second workspace: %v", err)
// 	}

// 	// Overwrite with second workspace
// 	if err := storage.Put(ctx, testPath, data2); err != nil {
// 		t.Fatalf("failed to overwrite workspace in GCS: %v", err)
// 	}

// 	// Load and verify it's the second workspace
// 	loadedWs := workspace.NewNoFlush("temp")

// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from GCS: %v", err)
// 	}

// 	if err := loadedWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Should be the second workspace (overwritten)
// 	if loadedWs.ID != workspaceID2 {
// 		t.Errorf("expected workspace ID %s (second), got %s", workspaceID2, loadedWs.ID)
// 	}

// 	if loadedWs.ID == workspaceID1 {
// 		t.Error("file was not overwritten - still contains first workspace")
// 	}

// 	t.Logf("Successfully verified GCS file overwrite at path: %s", testPath)
// }

// func TestEngine_GCS_NestedPathHandling(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	// Test that nested paths work in GCS
// 	workspaceID := uuid.New().String()
// 	ws := workspace.NewNoFlush(workspaceID)

// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	// Use nested path structure
// 	testPath := fmt.Sprintf("nested/deep/path/%s/workspace.gob", uuid.New().String())
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Write to GCS with nested path
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write workspace to nested GCS path: %v", err)
// 	}

// 	// Read back from nested path
// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read workspace from nested GCS path: %v", err)
// 	}

// 	// Verify data integrity
// 	newWs := workspace.NewNoFlush("temp")
// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	if newWs.ID != workspaceID {
// 		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
// 	}

// 	t.Logf("Successfully handled nested path in GCS: %s", testPath)
// }

// func TestEngine_GCS_ComplexEntitiesRoundtrip(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	sysId := uuid.New().String()
// 	jobAgentId := uuid.New().String()
// 	deploymentId := uuid.New().String()
// 	deploymentVersionId := uuid.New().String()
// 	env1Id := uuid.New().String()
// 	env2Id := uuid.New().String()
// 	resource1Id := uuid.New().String()
// 	resource2Id := uuid.New().String()
// 	policyId := uuid.New().String()

// 	// Create workspace with complex entity graph
// 	engine := integration.NewTestWorkspace(t,
// 		integration.WithJobAgent(
// 			integration.JobAgentID(jobAgentId),
// 			integration.JobAgentName("gcs-complex-agent"),
// 		),
// 		integration.WithSystem(
// 			integration.SystemID(sysId),
// 			integration.SystemName("gcs-complex-system"),
// 			integration.WithDeployment(
// 				integration.DeploymentID(deploymentId),
// 				integration.DeploymentName("gcs-api-service"),
// 				integration.DeploymentJobAgent(jobAgentId),
// 				integration.WithDeploymentVersion(
// 					integration.DeploymentVersionID(deploymentVersionId),
// 					integration.DeploymentVersionTag("v2.1.0"),
// 				),
// 			),
// 			integration.WithEnvironment(
// 				integration.EnvironmentID(env1Id),
// 				integration.EnvironmentName("gcs-production"),
// 			),
// 			integration.WithEnvironment(
// 				integration.EnvironmentID(env2Id),
// 				integration.EnvironmentName("gcs-staging"),
// 			),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resource1Id),
// 			integration.ResourceName("gcs-resource-1"),
// 		),
// 		integration.WithResource(
// 			integration.ResourceID(resource2Id),
// 			integration.ResourceName("gcs-resource-2"),
// 		),
// 		integration.WithPolicy(
// 			integration.PolicyID(policyId),
// 			integration.PolicyName("gcs-approval-policy"),
// 		),
// 	)

// 	ws := engine.Workspace()
// 	workspaceID := ws.ID

// 	// Capture original entities
// 	originalSys, _ := ws.Systems().Get(sysId)
// 	originalDeployment, _ := ws.Deployments().Get(deploymentId)
// 	originalJobAgent, _ := ws.JobAgents().Get(jobAgentId)
// 	originalEnv1, _ := ws.Environments().Get(env1Id)
// 	originalEnv2, _ := ws.Environments().Get(env2Id)
// 	originalResource1, _ := ws.Resources().Get(resource1Id)
// 	originalResource2, _ := ws.Resources().Get(resource2Id)
// 	originalPolicy, _ := ws.Policies().Get(policyId)

// 	// Encode and save to GCS
// 	data, err := ws.GobEncode()
// 	if err != nil {
// 		t.Fatalf("failed to encode workspace: %v", err)
// 	}

// 	testPath := fmt.Sprintf("test-complex-%s.gob", uuid.New().String())
// 	if err := storage.Put(ctx, testPath, data); err != nil {
// 		t.Fatalf("failed to write complex workspace to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Load from GCS
// 	newWs := workspace.New(workspaceID)

// 	loadedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read complex workspace from GCS: %v", err)
// 	}

// 	if err := newWs.GobDecode(loadedData); err != nil {
// 		t.Fatalf("failed to decode workspace: %v", err)
// 	}

// 	// Verify all entities with deep field comparison
// 	restoredSys, ok := newWs.Systems().Get(sysId)
// 	if !ok {
// 		t.Fatal("system not found after GCS restore")
// 	}
// 	verifySystemsEqual(t, originalSys, restoredSys, "system")

// 	restoredDeployment, ok := newWs.Deployments().Get(deploymentId)
// 	if !ok {
// 		t.Fatal("deployment not found after GCS restore")
// 	}
// 	verifyDeploymentsEqual(t, originalDeployment, restoredDeployment, "deployment")

// 	restoredJobAgent, ok := newWs.JobAgents().Get(jobAgentId)
// 	if !ok {
// 		t.Fatal("job agent not found after GCS restore")
// 	}
// 	verifyJobAgentsEqual(t, originalJobAgent, restoredJobAgent, "job agent")

// 	restoredEnv1, ok := newWs.Environments().Get(env1Id)
// 	if !ok {
// 		t.Error("environment production not found after GCS restore")
// 	} else {
// 		verifyEnvironmentsEqual(t, originalEnv1, restoredEnv1, "environment production")
// 	}

// 	restoredEnv2, ok := newWs.Environments().Get(env2Id)
// 	if !ok {
// 		t.Error("environment staging not found after GCS restore")
// 	} else {
// 		verifyEnvironmentsEqual(t, originalEnv2, restoredEnv2, "environment staging")
// 	}

// 	restoredResource1, ok := newWs.Resources().Get(resource1Id)
// 	if !ok {
// 		t.Error("resource 1 not found after GCS restore")
// 	} else {
// 		verifyResourcesEqual(t, originalResource1, restoredResource1, "resource 1")
// 	}

// 	restoredResource2, ok := newWs.Resources().Get(resource2Id)
// 	if !ok {
// 		t.Error("resource 2 not found after GCS restore")
// 	} else {
// 		verifyResourcesEqual(t, originalResource2, restoredResource2, "resource 2")
// 	}

// 	restoredPolicy, ok := newWs.Policies().Get(policyId)
// 	if !ok {
// 		t.Error("policy not found after GCS restore")
// 	} else {
// 		verifyPoliciesEqual(t, originalPolicy, restoredPolicy, "policy")
// 	}

// 	t.Logf("Successfully verified complex entity graph in GCS at path: %s", testPath)
// }

// func TestEngine_GCS_RawBinaryDataIntegrity(t *testing.T) {
// 	ctx := context.Background()
// 	storage := setupGCSTest(t, ctx)

// 	// Test that raw binary data is preserved without corruption
// 	testData := []byte{
// 		0x00, 0xFF, 0xAB, 0xCD, 0xEF, // Binary data with null bytes and high values
// 		0x01, 0x02, 0x03, 0x04, 0x05,
// 		0x7F, 0x80, 0x81, 0xFE, 0xFF,
// 	}

// 	testPath := fmt.Sprintf("test-binary-%s.dat", uuid.New().String())

// 	// Write binary data to GCS
// 	if err := storage.Put(ctx, testPath, testData); err != nil {
// 		t.Fatalf("failed to write binary data to GCS: %v", err)
// 	}
// 	defer cleanupGCSFile(t, ctx, storage, testPath)

// 	// Read back
// 	retrievedData, err := storage.Get(ctx, testPath)
// 	if err != nil {
// 		t.Fatalf("failed to read binary data from GCS: %v", err)
// 	}

// 	// Verify exact byte-for-byte match
// 	if len(retrievedData) != len(testData) {
// 		t.Fatalf("data length mismatch: expected %d bytes, got %d bytes", len(testData), len(retrievedData))
// 	}

// 	for i, expectedByte := range testData {
// 		if retrievedData[i] != expectedByte {
// 			t.Errorf("byte %d mismatch: expected 0x%02X, got 0x%02X", i, expectedByte, retrievedData[i])
// 		}
// 	}

// 	t.Logf("Successfully verified binary data integrity in GCS at path: %s", testPath)
// }

// // Helper to check if error is a "not found" error
// func isNotFoundError(err error) bool {
// 	if err == nil {
// 		return false
// 	}
// 	errMsg := err.Error()
// 	return contains(errMsg, "not found") ||
// 		contains(errMsg, "does not exist") ||
// 		contains(errMsg, "ErrWorkspaceSnapshotNotFound")
// }

// func contains(s, substr string) bool {
// 	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
// 		(len(s) > 0 && len(substr) > 0 && indexOfString(s, substr) >= 0))
// }

// func indexOfString(s, substr string) int {
// 	for i := 0; i <= len(s)-len(substr); i++ {
// 		if s[i:i+len(substr)] == substr {
// 			return i
// 		}
// 	}
// 	return -1
// }
