package targetsmanager

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// Helper functions for creating test entities

func createTestReleaseTarget(envID, depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: envID,
		DeploymentId:  depID,
		ResourceId:    resID,
	}
}

func createTestEnvironment(id, systemID, name string) *oapi.Environment {
	return &oapi.Environment{
		Id:       id,
		SystemId: systemID,
		Name:     name,
	}
}

func createTestDeployment(id, systemID, name string) *oapi.Deployment {
	return &oapi.Deployment{
		Id:       id,
		SystemId: systemID,
		Name:     name,
	}
}

func createTestDeploymentVersion(id, deploymentID, tag string) *oapi.DeploymentVersion {
	now := time.Now().Format(time.RFC3339)
	return &oapi.DeploymentVersion{
		Id:           id,
		DeploymentId: deploymentID,
		Tag:          tag,
		CreatedAt:    now,
	}
}

func createTestResource(workspaceID, id, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  name,
		Kind:        "test-kind",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata:    map[string]string{},
	}
}

func createTestPolicy(id, workspaceID, name string) *oapi.Policy {
	now := time.Now().Format(time.RFC3339)
	return &oapi.Policy{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		CreatedAt:   now,
		Rules:       []oapi.PolicyRule{},
		Selectors:   []oapi.PolicyTargetSelector{},
	}
}

func createTestSystem(workspaceID, id, name string) *oapi.System {
	return &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

func createTestJob(id, releaseID string) *oapi.Job {
	return &oapi.Job{
		Id:        id,
		ReleaseId: releaseID,
		Status:    oapi.Pending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func createTestRelease(target oapi.ReleaseTarget, version *oapi.DeploymentVersion) *oapi.Release {
	now := time.Now().Format(time.RFC3339)
	return &oapi.Release{
		ReleaseTarget:      target,
		Version:            *version,
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          now,
	}
}

// Test buildTargetIndex
func TestBuildTargetIndex(t *testing.T) {
	envID1 := uuid.New().String()
	envID2 := uuid.New().String()
	depID1 := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID1, depID1, resID1)
	target2 := createTestReleaseTarget(envID1, depID1, resID2)
	target3 := createTestReleaseTarget(envID2, depID1, resID1)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
		target3.Key(): target3,
	}

	idx := buildTargetIndex(targets)

	// Test byEnvironment index
	assert.Len(t, idx.byEnvironment[envID1], 2, "envID1 should have 2 targets")
	assert.Len(t, idx.byEnvironment[envID2], 1, "envID2 should have 1 target")

	// Test byDeployment index
	assert.Len(t, idx.byDeployment[depID1], 3, "depID1 should have 3 targets")

	// Test byResource index
	assert.Len(t, idx.byResource[resID1], 2, "resID1 should have 2 targets")
	assert.Len(t, idx.byResource[resID2], 1, "resID2 should have 1 target")
}

// Test taint on Policy change (should taint all targets)
func TestTaintProcessor_PolicyChange_TaintsAll(t *testing.T) {
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID, resID1)
	target2 := createTestReleaseTarget(envID, depID, resID2)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with policy change
	cs := changeset.NewChangeSet[any]()
	policy := createTestPolicy(uuid.New().String(), uuid.New().String(), "test-policy")
	cs.Record(changeset.ChangeTypeCreate, policy)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify all targets are tainted
	assert.Len(t, tainted, 2, "all targets should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.Contains(t, tainted, target2.Key())
}

// Test taint on System change (should taint all targets)
func TestTaintProcessor_SystemChange_TaintsAll(t *testing.T) {
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID, resID1)
	target2 := createTestReleaseTarget(envID, depID, resID2)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with system change
	cs := changeset.NewChangeSet[any]()
	system := createTestSystem(uuid.New().String(), uuid.New().String(), "test-system")
	cs.Record(changeset.ChangeTypeUpdate, system)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify all targets are tainted
	assert.Len(t, tainted, 2, "all targets should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.Contains(t, tainted, target2.Key())
}

// Test taint on Environment change
func TestTaintProcessor_EnvironmentChange_TaintsEnvironmentTargets(t *testing.T) {
	st := store.New()

	// Setup targets across different environments
	envID1 := uuid.New().String()
	envID2 := uuid.New().String()
	depID := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID1, depID, resID1) // In env1
	target2 := createTestReleaseTarget(envID2, depID, resID2) // In env2

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with environment change for env1 only
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(envID1, uuid.New().String(), "test-env")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify only env1 targets are tainted
	assert.Len(t, tainted, 1, "only env1 targets should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.NotContains(t, tainted, target2.Key())
}

// Test taint on Deployment change
func TestTaintProcessor_DeploymentChange_TaintsDeploymentTargets(t *testing.T) {
	st := store.New()

	// Setup targets across different deployments
	envID := uuid.New().String()
	depID1 := uuid.New().String()
	depID2 := uuid.New().String()
	resID := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID1, resID) // In dep1
	target2 := createTestReleaseTarget(envID, depID2, resID) // In dep2

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with deployment change for dep1 only
	cs := changeset.NewChangeSet[any]()
	dep := createTestDeployment(depID1, uuid.New().String(), "test-deployment")
	cs.Record(changeset.ChangeTypeUpdate, dep)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify only dep1 targets are tainted
	assert.Len(t, tainted, 1, "only dep1 targets should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.NotContains(t, tainted, target2.Key())
}

// Test taint on DeploymentVersion change
func TestTaintProcessor_DeploymentVersionChange_TaintsDeploymentTargets(t *testing.T) {
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID1 := uuid.New().String()
	depID2 := uuid.New().String()
	resID := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID1, resID)
	target2 := createTestReleaseTarget(envID, depID2, resID)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with deployment version change for dep1
	cs := changeset.NewChangeSet[any]()
	version := createTestDeploymentVersion(uuid.New().String(), depID1, "v1.0.0")
	cs.Record(changeset.ChangeTypeCreate, version)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify only dep1 targets are tainted
	assert.Len(t, tainted, 1, "only targets for the deployment with new version should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.NotContains(t, tainted, target2.Key())
}

// Test taint on Resource change
func TestTaintProcessor_ResourceChange_TaintsResourceTargets(t *testing.T) {
	st := store.New()

	// Setup targets across different resources
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID, resID1)
	target2 := createTestReleaseTarget(envID, depID, resID2)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with resource change for resID1 only
	cs := changeset.NewChangeSet[any]()
	resource := createTestResource(uuid.New().String(), resID1, "test-resource")
	cs.Record(changeset.ChangeTypeUpdate, resource)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify only resID1 targets are tainted
	assert.Len(t, tainted, 1, "only resource1 targets should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.NotContains(t, tainted, target2.Key())
}

// Test taint on Job change
func TestTaintProcessor_JobChange_TaintsJobReleaseTarget(t *testing.T) {
	ctx := context.Background()
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID, resID1)
	target2 := createTestReleaseTarget(envID, depID, resID2)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create a release and add to store
	version := createTestDeploymentVersion(uuid.New().String(), depID, "v1.0.0")
	release := createTestRelease(*target1, version)
	releaseID := release.ID()
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Create changeset with job change
	cs := changeset.NewChangeSet[any]()
	job := createTestJob(uuid.New().String(), releaseID)
	cs.Record(changeset.ChangeTypeUpdate, job)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify only the target associated with the job's release is tainted
	assert.Len(t, tainted, 1, "only the job's release target should be tainted")
	assert.Contains(t, tainted, target1.Key())
	assert.NotContains(t, tainted, target2.Key())
}

// Test taint with job that has non-existent release
func TestTaintProcessor_JobChange_NonExistentRelease(t *testing.T) {
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID := uuid.New().String()

	target := createTestReleaseTarget(envID, depID, resID)
	targets := map[string]*oapi.ReleaseTarget{
		target.Key(): target,
	}

	// Create changeset with job referencing non-existent release
	cs := changeset.NewChangeSet[any]()
	job := createTestJob(uuid.New().String(), "non-existent-release-id")
	cs.Record(changeset.ChangeTypeUpdate, job)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify no targets are tainted
	assert.Len(t, tainted, 0, "no targets should be tainted for non-existent release")
}

// Test multiple changes in single pass
func TestTaintProcessor_MultipleChanges_SinglePass(t *testing.T) {
	st := store.New()

	// Setup targets across different dimensions
	envID1 := uuid.New().String()
	envID2 := uuid.New().String()
	depID1 := uuid.New().String()
	depID2 := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID1, depID1, resID1)
	target2 := createTestReleaseTarget(envID2, depID1, resID2)
	target3 := createTestReleaseTarget(envID1, depID2, resID2)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
		target3.Key(): target3,
	}

	// Create changeset with multiple changes
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(envID1, uuid.New().String(), "test-env")
	dep := createTestDeployment(depID1, uuid.New().String(), "test-dep")
	resource := createTestResource(uuid.New().String(), resID2, "test-resource")

	cs.Record(changeset.ChangeTypeUpdate, env)
	cs.Record(changeset.ChangeTypeUpdate, dep)
	cs.Record(changeset.ChangeTypeUpdate, resource)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify all targets are tainted (target1 by env+dep, target2 by dep+res, target3 by env+res)
	assert.Len(t, tainted, 3, "all targets should be tainted by various changes")
	assert.Contains(t, tainted, target1.Key())
	assert.Contains(t, tainted, target2.Key())
	assert.Contains(t, tainted, target3.Key())
}

// Test empty changeset
func TestTaintProcessor_EmptyChangeset(t *testing.T) {
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID := uuid.New().String()

	target := createTestReleaseTarget(envID, depID, resID)
	targets := map[string]*oapi.ReleaseTarget{
		target.Key(): target,
	}

	// Create empty changeset
	cs := changeset.NewChangeSet[any]()

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify no targets are tainted
	assert.Len(t, tainted, 0, "no targets should be tainted with empty changeset")
}

// Test that Policy change short-circuits (taints all and returns early)
func TestTaintProcessor_PolicyChange_ShortCircuits(t *testing.T) {
	st := store.New()

	// Setup targets
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID1 := uuid.New().String()
	resID2 := uuid.New().String()

	target1 := createTestReleaseTarget(envID, depID, resID1)
	target2 := createTestReleaseTarget(envID, depID, resID2)

	targets := map[string]*oapi.ReleaseTarget{
		target1.Key(): target1,
		target2.Key(): target2,
	}

	// Create changeset with policy change FIRST, then other changes
	cs := changeset.NewChangeSet[any]()
	policy := createTestPolicy(uuid.New().String(), uuid.New().String(), "test-policy")
	env := createTestEnvironment(envID, uuid.New().String(), "test-env")

	cs.Record(changeset.ChangeTypeCreate, policy)
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify all targets are tainted (policy should cause all to be tainted and return early)
	assert.Len(t, tainted, 2, "all targets should be tainted by policy change")
	assert.Contains(t, tainted, target1.Key())
	assert.Contains(t, tainted, target2.Key())
}

// Test with no targets
func TestTaintProcessor_NoTargets(t *testing.T) {
	st := store.New()
	targets := map[string]*oapi.ReleaseTarget{}

	// Create changeset with changes
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(uuid.New().String(), uuid.New().String(), "test-env")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify no targets are tainted (because there are none)
	assert.Len(t, tainted, 0, "no targets to taint")
}

// Test taint deduplication (same target tainted by multiple changes)
func TestTaintProcessor_Deduplication(t *testing.T) {
	st := store.New()

	// Setup a single target
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID := uuid.New().String()

	target := createTestReleaseTarget(envID, depID, resID)
	targets := map[string]*oapi.ReleaseTarget{
		target.Key(): target,
	}

	// Create changeset with multiple changes that all affect the same target
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(envID, uuid.New().String(), "test-env")
	dep := createTestDeployment(depID, uuid.New().String(), "test-dep")
	resource := createTestResource(uuid.New().String(), resID, "test-resource")

	cs.Record(changeset.ChangeTypeUpdate, env)
	cs.Record(changeset.ChangeTypeUpdate, dep)
	cs.Record(changeset.ChangeTypeUpdate, resource)

	// Process
	tp := NewTaintProcessor(st, cs, targets)
	tainted := tp.Tainted()

	// Verify target is tainted only once (deduplication works)
	assert.Len(t, tainted, 1, "target should be tainted once despite multiple changes")
	assert.Contains(t, tainted, target.Key())
}
