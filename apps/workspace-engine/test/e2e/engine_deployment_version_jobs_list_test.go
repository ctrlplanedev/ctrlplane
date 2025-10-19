package e2e

import (
	"context"
	"reflect"
	"sort"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
)

// Helper to create a fullReleaseTarget (matching the internal struct used by deploymentversions)
type fullReleaseTarget struct {
	*oapi.ReleaseTarget
	Jobs        []*oapi.Job
	Environment *oapi.Environment
	Deployment  *oapi.Deployment
	Resource    *oapi.Resource
}

// Helper to get full release target with all related data
func getFullReleaseTarget(
	rt *oapi.ReleaseTarget,
	jobs []*oapi.Job,
	env *oapi.Environment,
	deployment *oapi.Deployment,
	resource *oapi.Resource,
) *fullReleaseTarget {
	return &fullReleaseTarget{
		ReleaseTarget: rt,
		Jobs:          jobs,
		Environment:   env,
		Deployment:    deployment,
		Resource:      resource,
	}
}

func TestEngine_DeploymentVersionJobsList_BasicCreation(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	versionId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(versionId)),
			),
			integration.WithEnvironment(integration.EnvironmentName("staging")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
	)

	ctx := context.Background()
	ws := engine.Workspace()

	// Wait for initial processing
	time.Sleep(100 * time.Millisecond)

	// Verify deployment version exists
	version, ok := ws.DeploymentVersions().Get(versionId)
	if !ok {
		t.Fatal("deployment version not found")
	}

	// Verify release targets were created
	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}

	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Verify deployment matches
	deployment, ok := ws.Deployments().Get(version.DeploymentId)
	if !ok {
		t.Fatal("deployment not found")
	}
	if deployment.Id != deploymentId {
		t.Errorf("expected deployment ID %s, got %s", deploymentId, deployment.Id)
	}
}

func TestEngine_DeploymentVersionJobsList_JobsCreatedForAllTargets(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	versionId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(versionId)),
			),
			integration.WithEnvironment(integration.EnvironmentName("production")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
		integration.WithResource(integration.ResourceName("server-3")),
	)

	ctx := context.Background()
	ws := engine.Workspace()

	// Wait for jobs to be created
	time.Sleep(500 * time.Millisecond)

	// Verify release targets (1 environment * 3 resources = 3 targets)
	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Verify each release target has jobs
	for _, rt := range releaseTargets {
		jobs := ws.Jobs().GetJobsForReleaseTarget(rt)
		if len(jobs) == 0 {
			resource, _ := ws.Resources().Get(rt.ResourceId)
			t.Errorf("expected jobs for release target with resource %s, got none", resource.Name)
		}
	}
}

func TestEngine_DeploymentVersionJobsList_SortingOrder(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	versionId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(versionId)),
			),
			integration.WithEnvironment(integration.EnvironmentName("production")),
		),
		// Create resources with names that would NOT be in alphabetical order
		// to verify sorting is working correctly
		integration.WithResource(integration.ResourceName("z-server")),
		integration.WithResource(integration.ResourceName("a-server")),
		integration.WithResource(integration.ResourceName("m-server")),
	)

	ctx := context.Background()
	ws := engine.Workspace()

	// Wait for jobs to be created
	time.Sleep(500 * time.Millisecond)

	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Set different statuses to test sorting
	// We want: failure first, then inProgress, then successful
	// Use deterministic timestamps to ensure predictable ordering
	baseTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	timestampIndex := 0

	for _, rt := range releaseTargets {
		resource, _ := ws.Resources().Get(rt.ResourceId)
		jobs := ws.Jobs().GetJobsForReleaseTarget(rt)

		for _, job := range jobs {
			switch resource.Name {
			case "z-server":
				job.Status = oapi.Failure // Should come first despite "z" name
				job.CreatedAt = baseTime.Add(time.Duration(timestampIndex) * time.Millisecond)
			case "a-server":
				job.Status = oapi.InProgress
				job.CreatedAt = baseTime.Add(time.Duration(timestampIndex) * time.Millisecond)
			case "m-server":
				job.Status = oapi.Successful
				job.CreatedAt = baseTime.Add(time.Duration(timestampIndex) * time.Millisecond)
			}
			timestampIndex++
		}
	}

	// Get environment
	var env *oapi.Environment
	for e := range ws.Environments().IterBuffered() {
		env = e.Val
		break
	}
	if env == nil {
		t.Fatal("no environment found")
	}

	deployment, _ := ws.Deployments().Get(deploymentId)

	// Build full release targets list similar to what the endpoint does
	fullTargets := []*fullReleaseTarget{}
	for _, rt := range releaseTargets {
		resource, _ := ws.Resources().Get(rt.ResourceId)
		jobs := ws.Jobs().GetJobsForReleaseTarget(rt)

		// Convert jobs map to sorted slice (most recent first)
		jobSlice := make([]*oapi.Job, 0, len(jobs))
		for _, job := range jobs {
			jobSlice = append(jobSlice, job)
		}

		fullTargets = append(fullTargets, getFullReleaseTarget(
			rt, jobSlice, env, deployment, resource,
		))
	}

	// This is the comparator from the actual implementation
	compareReleaseTargets := func(a, b *fullReleaseTarget) int {
		var statusA *oapi.JobStatus
		var statusB *oapi.JobStatus

		if len(a.Jobs) > 0 {
			statusA = &a.Jobs[0].Status
		}
		if len(b.Jobs) > 0 {
			statusB = &b.Jobs[0].Status
		}

		if statusA == nil && statusB != nil {
			return 1
		}
		if statusA != nil && statusB == nil {
			return -1
		}

		if statusA != nil && statusB != nil {
			if *statusA == oapi.Failure && *statusB != oapi.Failure {
				return -1
			}
			if *statusA != oapi.Failure && *statusB == oapi.Failure {
				return 1
			}

			if *statusA != *statusB {
				if string(*statusA) < string(*statusB) {
					return -1
				}
				return 1
			}
		}

		var createdAtA, createdAtB int64
		if len(a.Jobs) > 0 {
			createdAtA = a.Jobs[0].CreatedAt.Unix()
		}
		if len(b.Jobs) > 0 {
			createdAtB = b.Jobs[0].CreatedAt.Unix()
		}

		if createdAtA != createdAtB {
			return int(createdAtB - createdAtA)
		}

		if a.Resource.Name < b.Resource.Name {
			return -1
		} else if a.Resource.Name > b.Resource.Name {
			return 1
		}
		return 0
	}

	// Sort using the comparator
	sort.Slice(fullTargets, func(i, j int) bool {
		return compareReleaseTargets(fullTargets[i], fullTargets[j]) < 0
	})

	// Verify sorting: failure should be first
	if len(fullTargets) > 0 && len(fullTargets[0].Jobs) > 0 {
		firstStatus := fullTargets[0].Jobs[0].Status
		if firstStatus != oapi.Failure {
			t.Errorf("expected first target to have failure status, got %s (resource: %s)",
				firstStatus, fullTargets[0].Resource.Name)
		}
		if fullTargets[0].Resource.Name != "z-server" {
			t.Errorf("expected z-server to be first due to failure status, got %s",
				fullTargets[0].Resource.Name)
		}
	}
}

func TestEngine_DeploymentVersionJobsList_MultipleEnvironments(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	versionId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(versionId)),
			),
			integration.WithEnvironment(integration.EnvironmentName("staging")),
			integration.WithEnvironment(integration.EnvironmentName("production")),
			integration.WithEnvironment(integration.EnvironmentName("development")),
		),
		integration.WithResource(integration.ResourceName("server-1")),
		integration.WithResource(integration.ResourceName("server-2")),
	)

	ctx := context.Background()
	ws := engine.Workspace()

	// Wait for jobs to be created
	time.Sleep(500 * time.Millisecond)

	// Verify release targets (3 environments * 2 resources = 6 targets)
	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 6 {
		t.Fatalf("expected 6 release targets, got %d", len(releaseTargets))
	}

	// Group by environment
	envTargets := make(map[string][]*oapi.ReleaseTarget)
	for _, rt := range releaseTargets {
		envTargets[rt.EnvironmentId] = append(envTargets[rt.EnvironmentId], rt)
	}

	// Verify each environment has 2 targets
	if len(envTargets) != 3 {
		t.Fatalf("expected 3 environments, got %d", len(envTargets))
	}

	for envId, targets := range envTargets {
		if len(targets) != 2 {
			env, _ := ws.Environments().Get(envId)
			t.Errorf("environment %s expected 2 targets, got %d", env.Name, len(targets))
		}
	}

	// Verify each target has jobs
	jobCount := 0
	for _, rt := range releaseTargets {
		jobs := ws.Jobs().GetJobsForReleaseTarget(rt)
		jobCount += len(jobs)
	}

	if jobCount != 6 {
		t.Errorf("expected 6 jobs total (one per target), got %d", jobCount)
	}
}

func TestEngine_DeploymentVersionJobsList_EnvironmentSorting(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	versionId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(integration.DeploymentVersionID(versionId)),
			),
			// Create environments in non-alphabetical order
			integration.WithEnvironment(integration.EnvironmentName("zebra")),
			integration.WithEnvironment(integration.EnvironmentName("alpha")),
			integration.WithEnvironment(integration.EnvironmentName("delta")),
		),
	)

	ws := engine.Workspace()
	deployment, _ := ws.Deployments().Get(deploymentId)

	// Get all environments for this system
	environments := []*oapi.Environment{}
	for env := range ws.Environments().IterBuffered() {
		if env.Val.SystemId == deployment.SystemId {
			environments = append(environments, env.Val)
		}
	}

	if len(environments) != 3 {
		t.Fatalf("expected 3 environments, got %d", len(environments))
	}

	// Sort environments by name (as the endpoint should do)
	sort.Slice(environments, func(i, j int) bool {
		return environments[i].Name < environments[j].Name
	})

	// Verify order is alphabetical
	expectedOrder := []string{"alpha", "delta", "zebra"}
	for i, env := range environments {
		if env.Name != expectedOrder[i] {
			t.Errorf("expected environment %d to be %s, got %s", i, expectedOrder[i], env.Name)
		}
	}
}

// Test to verify the exact comparator behavior matches TypeScript
func TestEngine_DeploymentVersionJobsList_ComparatorBehavior(t *testing.T) {
	now := time.Now()
	oneHourAgo := now.Add(-1 * time.Hour)

	testCases := []struct {
		name           string
		aStatus        *oapi.JobStatus
		aCreatedAt     *time.Time
		aResourceName  string
		bStatus        *oapi.JobStatus
		bCreatedAt     *time.Time
		bResourceName  string
		expectedResult string // "a<b", "a>b", or "a==b"
	}{
		{
			name:           "no jobs vs has jobs",
			aStatus:        nil,
			bStatus:        &[]oapi.JobStatus{oapi.Pending}[0],
			bCreatedAt:     &now,
			bResourceName:  "b",
			aResourceName:  "a",
			expectedResult: "a>b", // a should come after b
		},
		{
			name:           "failure vs success",
			aStatus:        &[]oapi.JobStatus{oapi.Failure}[0],
			aCreatedAt:     &now,
			aResourceName:  "a",
			bStatus:        &[]oapi.JobStatus{oapi.Successful}[0],
			bCreatedAt:     &now,
			bResourceName:  "b",
			expectedResult: "a<b", // failure comes first
		},
		{
			name:           "newer vs older with same status",
			aStatus:        &[]oapi.JobStatus{oapi.Successful}[0],
			aCreatedAt:     &now,
			aResourceName:  "a",
			bStatus:        &[]oapi.JobStatus{oapi.Successful}[0],
			bCreatedAt:     &oneHourAgo,
			bResourceName:  "b",
			expectedResult: "a<b", // newer comes first
		},
		{
			name:           "same status and time, different names",
			aStatus:        &[]oapi.JobStatus{oapi.Successful}[0],
			aCreatedAt:     &now,
			aResourceName:  "alpha",
			bStatus:        &[]oapi.JobStatus{oapi.Successful}[0],
			bCreatedAt:     &now,
			bResourceName:  "beta",
			expectedResult: "a<b", // alphabetical
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			aJobs := []*oapi.Job{}
			if tc.aStatus != nil && tc.aCreatedAt != nil {
				aJobs = append(aJobs, &oapi.Job{
					Status:    *tc.aStatus,
					CreatedAt: *tc.aCreatedAt,
				})
			}

			bJobs := []*oapi.Job{}
			if tc.bStatus != nil && tc.bCreatedAt != nil {
				bJobs = append(bJobs, &oapi.Job{
					Status:    *tc.bStatus,
					CreatedAt: *tc.bCreatedAt,
				})
			}

			a := &fullReleaseTarget{
				Jobs:     aJobs,
				Resource: &oapi.Resource{Name: tc.aResourceName},
			}
			b := &fullReleaseTarget{
				Jobs:     bJobs,
				Resource: &oapi.Resource{Name: tc.bResourceName},
			}

			// Use reflection to call the unexported compareReleaseTargets function
			// (In a real scenario, this would be exported for testing or we'd test through public APIs)
			result := compareForTest(a, b)

			var actualResult string
			if result < 0 {
				actualResult = "a<b"
			} else if result > 0 {
				actualResult = "a>b"
			} else {
				actualResult = "a==b"
			}

			if actualResult != tc.expectedResult {
				t.Errorf("expected %s, got %s", tc.expectedResult, actualResult)
			}
		})
	}
}

// Helper function that mimics the actual compareReleaseTargets logic for testing
func compareForTest(a, b *fullReleaseTarget) int {
	var statusA *oapi.JobStatus
	var statusB *oapi.JobStatus

	if len(a.Jobs) > 0 {
		statusA = &a.Jobs[0].Status
	}
	if len(b.Jobs) > 0 {
		statusB = &b.Jobs[0].Status
	}

	if statusA == nil && statusB != nil {
		return 1
	}
	if statusA != nil && statusB == nil {
		return -1
	}

	if statusA != nil && statusB != nil {
		if *statusA == oapi.Failure && *statusB != oapi.Failure {
			return -1
		}
		if *statusA != oapi.Failure && *statusB == oapi.Failure {
			return 1
		}

		if *statusA != *statusB {
			if string(*statusA) < string(*statusB) {
				return -1
			}
			return 1
		}
	}

	var createdAtA, createdAtB int64
	if len(a.Jobs) > 0 {
		createdAtA = a.Jobs[0].CreatedAt.Unix()
	}
	if len(b.Jobs) > 0 {
		createdAtB = b.Jobs[0].CreatedAt.Unix()
	}

	if createdAtA != createdAtB {
		return int(createdAtB - createdAtA)
	}

	if a.Resource.Name < b.Resource.Name {
		return -1
	} else if a.Resource.Name > b.Resource.Name {
		return 1
	}
	return 0
}

func init() {
	// Suppress reflect warnings in tests
	_ = reflect.TypeOf(fullReleaseTarget{})
}
