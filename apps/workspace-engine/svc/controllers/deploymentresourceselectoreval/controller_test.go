package deploymentresourceselectoreval

import (
	"context"
	"errors"
	"testing"
	"time"
	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

type mockGetter struct {
	deployment     *DeploymentInfo
	deployErr      error
	resources      []ResourceInfo
	listErr        error
	releaseTargets []ReleaseTarget
	releaseErr     error
}

func (m *mockGetter) GetDeploymentInfo(_ context.Context, _ uuid.UUID) (*DeploymentInfo, error) {
	return m.deployment, m.deployErr
}

func (m *mockGetter) StreamResources(_ context.Context, _ uuid.UUID, _ int, batches chan<- []ResourceInfo) error {
	defer close(batches)
	if m.listErr != nil {
		return m.listErr
	}
	if len(m.resources) > 0 {
		batches <- m.resources
	}
	return nil
}

func (m *mockGetter) GetReleaseTargetsForDeployment(_ context.Context, _ uuid.UUID) ([]ReleaseTarget, error) {
	return m.releaseTargets, m.releaseErr
}

type mockSetter struct {
	calledWith struct {
		deploymentID uuid.UUID
		resourceIDs  []uuid.UUID
	}
	err error
}

func (m *mockSetter) SetComputedDeploymentResources(_ context.Context, deploymentID uuid.UUID, resourceIDs []uuid.UUID) error {
	m.calledWith.deploymentID = deploymentID
	m.calledWith.resourceIDs = resourceIDs
	return m.err
}

type mockQueue struct {
	enqueued []reconcile.EnqueueParams
	err      error
}

func (m *mockQueue) Enqueue(_ context.Context, params reconcile.EnqueueParams) error {
	if m.err != nil {
		return m.err
	}
	m.enqueued = append(m.enqueued, params)
	return nil
}

func (m *mockQueue) Claim(context.Context, reconcile.ClaimParams) ([]reconcile.Item, error) {
	return nil, nil
}
func (m *mockQueue) ExtendLease(context.Context, reconcile.ExtendLeaseParams) error { return nil }
func (m *mockQueue) AckSuccess(context.Context, reconcile.AckSuccessParams) (reconcile.AckSuccessResult, error) {
	return reconcile.AckSuccessResult{}, nil
}
func (m *mockQueue) Retry(context.Context, reconcile.RetryParams) error { return nil }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func makeResource(name, kind string) ResourceInfo {
	return ResourceInfo{
		ID: uuid.New(),
		Raw: map[string]any{
			"name": name,
			"kind": kind,
			"metadata": map[string]any{
				"labels": map[string]any{},
			},
		},
	}
}

func makeResourceWithLabels(name, kind string, labels map[string]any) ResourceInfo {
	return ResourceInfo{
		ID: uuid.New(),
		Raw: map[string]any{
			"name": name,
			"kind": kind,
			"metadata": map[string]any{
				"labels": labels,
			},
		},
	}
}

func makeDeployment(selector string) *DeploymentInfo {
	return &DeploymentInfo{
		ResourceSelector: selector,
		WorkspaceID:      uuid.New(),
		Raw: map[string]any{
			"name":     "test-deployment",
			"metadata": map[string]any{},
		},
	}
}

func processItem(scopeID string) reconcile.Item {
	return reconcile.Item{
		ID:        1,
		Kind:      "deployment-resource-selector-eval",
		ScopeType: "deployment",
		ScopeID:   scopeID,
		EventTS:   time.Now(),
	}
}

// ---------------------------------------------------------------------------
// Process tests
// ---------------------------------------------------------------------------

func TestProcess_InvalidScopeID(t *testing.T) {
	c := &Controller{getter: &mockGetter{}, setter: &mockSetter{}, queue: &mockQueue{}}
	_, err := c.Process(context.Background(), processItem("not-a-uuid"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse deployment id")
}

func TestProcess_GetDeploymentError(t *testing.T) {
	deploymentID := uuid.New()
	getter := &mockGetter{deployErr: errors.New("db down")}
	c := &Controller{getter: getter, setter: &mockSetter{}, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "db down")
}

func TestProcess_InvalidSelector(t *testing.T) {
	deploymentID := uuid.New()
	getter := &mockGetter{
		deployment: &DeploymentInfo{
			ResourceSelector: ">>>invalid<<<",
			WorkspaceID:      uuid.New(),
			Raw:              map[string]any{},
		},
	}
	c := &Controller{getter: getter, setter: &mockSetter{}, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "compile deployment selector")
}

func TestProcess_ListResourcesError(t *testing.T) {
	deploymentID := uuid.New()
	getter := &mockGetter{
		deployment: makeDeployment("true"),
		listErr:    errors.New("timeout"),
	}
	c := &Controller{getter: getter, setter: &mockSetter{}, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

func TestProcess_SetterError(t *testing.T) {
	deploymentID := uuid.New()
	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{makeResource("r1", "Node")},
	}
	setter := &mockSetter{err: errors.New("write failed")}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "set computed deployment resources")
}

func TestProcess_DelegatesCorrectDeploymentID(t *testing.T) {
	deploymentID := uuid.New()
	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.NoError(t, err)
	assert.Equal(t, deploymentID, setter.calledWith.deploymentID)
}

// ---------------------------------------------------------------------------
// Selector matching tests
// ---------------------------------------------------------------------------

func TestProcess_MatchAllResources(t *testing.T) {
	r1 := makeResource("node-1", "Node")
	r2 := makeResource("node-2", "Node")
	r3 := makeResource("pod-1", "Pod")

	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{r1, r2, r3},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 3)
	assert.Contains(t, setter.calledWith.resourceIDs, r1.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, r2.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, r3.ID)
}

func TestProcess_MatchNoResources(t *testing.T) {
	getter := &mockGetter{
		deployment: makeDeployment("false"),
		resources: []ResourceInfo{
			makeResource("node-1", "Node"),
			makeResource("node-2", "Node"),
		},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Empty(t, setter.calledWith.resourceIDs)
}

func TestProcess_EmptyResourceList(t *testing.T) {
	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Empty(t, setter.calledWith.resourceIDs)
}

func TestProcess_FilterByKind(t *testing.T) {
	node1 := makeResource("node-1", "Node")
	node2 := makeResource("node-2", "Node")
	pod := makeResource("pod-1", "Pod")

	getter := &mockGetter{
		deployment: makeDeployment(`resource.kind == "Node"`),
		resources:  []ResourceInfo{node1, pod, node2},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, node1.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, node2.ID)
}

func TestProcess_FilterByName(t *testing.T) {
	r1 := makeResource("web-server", "Pod")
	r2 := makeResource("api-server", "Pod")
	r3 := makeResource("worker", "Pod")

	getter := &mockGetter{
		deployment: makeDeployment(`resource.name.endsWith("-server")`),
		resources:  []ResourceInfo{r1, r2, r3},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, r1.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, r2.ID)
}

func TestProcess_FilterByLabel(t *testing.T) {
	gpu := makeResourceWithLabels("node-1", "Node", map[string]any{"pool": "gpu"})
	cpu := makeResourceWithLabels("node-2", "Node", map[string]any{"pool": "cpu"})
	gpu2 := makeResourceWithLabels("node-3", "Node", map[string]any{"pool": "gpu"})

	getter := &mockGetter{
		deployment: makeDeployment(`resource.metadata.labels.pool == "gpu"`),
		resources:  []ResourceInfo{gpu, cpu, gpu2},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, gpu.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, gpu2.ID)
}

func TestProcess_CompoundSelector(t *testing.T) {
	match := makeResourceWithLabels("gpu-node-1", "Node", map[string]any{
		"pool": "gpu",
		"env":  "production",
	})
	wrongKind := makeResourceWithLabels("gpu-pod-1", "Pod", map[string]any{
		"pool": "gpu",
		"env":  "production",
	})
	wrongLabel := makeResourceWithLabels("cpu-node-1", "Node", map[string]any{
		"pool": "cpu",
		"env":  "production",
	})
	wrongEnv := makeResourceWithLabels("gpu-node-2", "Node", map[string]any{
		"pool": "gpu",
		"env":  "staging",
	})

	getter := &mockGetter{
		deployment: makeDeployment(
			`resource.kind == "Node" && resource.metadata.labels.pool == "gpu" && resource.metadata.labels.env == "production"`,
		),
		resources: []ResourceInfo{match, wrongKind, wrongLabel, wrongEnv},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 1)
	assert.Contains(t, setter.calledWith.resourceIDs, match.ID)
}

func TestProcess_MissingKeyReturnsNoMatch(t *testing.T) {
	withLabel := makeResourceWithLabels("node-1", "Node", map[string]any{"tier": "critical"})
	withoutLabel := makeResource("node-2", "Node")

	getter := &mockGetter{
		deployment: makeDeployment(`resource.metadata.labels.tier == "critical"`),
		resources:  []ResourceInfo{withLabel, withoutLabel},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 1)
	assert.Contains(t, setter.calledWith.resourceIDs, withLabel.ID)
}

func TestProcess_DeploymentCrossReference(t *testing.T) {
	deployment := &DeploymentInfo{
		ResourceSelector: `resource.kind == "Node" && deployment.name == "firmware"`,
		WorkspaceID:      uuid.New(),
		Raw: map[string]any{
			"name":     "firmware",
			"metadata": map[string]any{},
		},
	}

	node := makeResource("node-1", "Node")
	pod := makeResource("pod-1", "Pod")

	getter := &mockGetter{
		deployment: deployment,
		resources:  []ResourceInfo{node, pod},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 1)
	assert.Contains(t, setter.calledWith.resourceIDs, node.ID)
}

func TestProcess_DeploymentCrossReference_NoMatch(t *testing.T) {
	deployment := &DeploymentInfo{
		ResourceSelector: `deployment.name == "firmware"`,
		WorkspaceID:      uuid.New(),
		Raw: map[string]any{
			"name":     "ncore",
			"metadata": map[string]any{},
		},
	}

	getter := &mockGetter{
		deployment: deployment,
		resources:  []ResourceInfo{makeResource("node-1", "Node")},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Empty(t, setter.calledWith.resourceIDs)
}

func TestProcess_NameStartsWith(t *testing.T) {
	match1 := makeResource("prod-web-1", "Pod")
	match2 := makeResource("prod-api-1", "Pod")
	noMatch := makeResource("staging-web-1", "Pod")

	getter := &mockGetter{
		deployment: makeDeployment(`resource.name.startsWith("prod-")`),
		resources:  []ResourceInfo{match1, match2, noMatch},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, match1.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, match2.ID)
}

func TestProcess_LargeResourceSet(t *testing.T) {
	resources := make([]ResourceInfo, 500)
	expectedIDs := make([]uuid.UUID, 0)
	for i := range resources {
		kind := "Pod"
		if i%3 == 0 {
			kind = "Node"
		}
		resources[i] = makeResource("r-"+uuid.New().String(), kind)
		if kind == "Node" {
			expectedIDs = append(expectedIDs, resources[i].ID)
		}
	}

	getter := &mockGetter{
		deployment: makeDeployment(`resource.kind == "Node"`),
		resources:  resources,
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, len(expectedIDs))
	for _, id := range expectedIDs {
		assert.Contains(t, setter.calledWith.resourceIDs, id)
	}
}

func TestProcess_OrSelector(t *testing.T) {
	node := makeResource("node-1", "Node")
	pod := makeResource("pod-1", "Pod")
	svc := makeResource("svc-1", "Service")

	getter := &mockGetter{
		deployment: makeDeployment(`resource.kind == "Node" || resource.kind == "Pod"`),
		resources:  []ResourceInfo{node, pod, svc},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, node.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, pod.ID)
}

func TestProcess_NegationSelector(t *testing.T) {
	node := makeResource("node-1", "Node")
	pod := makeResource("pod-1", "Pod")
	svc := makeResource("svc-1", "Service")

	getter := &mockGetter{
		deployment: makeDeployment(`resource.kind != "Service"`),
		resources:  []ResourceInfo{node, pod, svc},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, node.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, pod.ID)
}

func TestProcess_DeploymentNameEqualsResourceName(t *testing.T) {
	deployment := &DeploymentInfo{
		ResourceSelector: `deployment.name == resource.name`,
		WorkspaceID:      uuid.New(),
		Raw: map[string]any{
			"name":     "web-server",
			"metadata": map[string]any{},
		},
	}

	match := makeResource("web-server", "Pod")
	noMatch1 := makeResource("api-server", "Pod")
	noMatch2 := makeResource("worker", "Pod")

	getter := &mockGetter{
		deployment: deployment,
		resources:  []ResourceInfo{match, noMatch1, noMatch2},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 1)
	assert.Contains(t, setter.calledWith.resourceIDs, match.ID)
}

func TestProcess_InListSelector(t *testing.T) {
	r1 := makeResourceWithLabels("n1", "Node", map[string]any{"env": "prod"})
	r2 := makeResourceWithLabels("n2", "Node", map[string]any{"env": "staging"})
	r3 := makeResourceWithLabels("n3", "Node", map[string]any{"env": "dev"})

	getter := &mockGetter{
		deployment: makeDeployment(`resource.metadata.labels.env in ["prod", "staging"]`),
		resources:  []ResourceInfo{r1, r2, r3},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, r1.ID)
	assert.Contains(t, setter.calledWith.resourceIDs, r2.ID)
}

// ---------------------------------------------------------------------------
// Release target enqueue tests
// ---------------------------------------------------------------------------

func TestProcess_EnqueuesReleaseTargets(t *testing.T) {
	deploymentID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()

	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{makeResource("node-1", "Node")},
		releaseTargets: []ReleaseTarget{
			{DeploymentID: deploymentID, EnvironmentID: envID, ResourceID: resID},
		},
	}
	setter := &mockSetter{}
	q := &mockQueue{}
	c := &Controller{getter: getter, setter: setter, queue: q}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.NoError(t, err)
	require.Len(t, q.enqueued, 1)
	assert.Equal(t, "desired-release", q.enqueued[0].Kind)
	assert.Equal(t, "release-target", q.enqueued[0].ScopeType)
	expectedScope := deploymentID.String() + ":" + envID.String() + ":" + resID.String()
	assert.Equal(t, expectedScope, q.enqueued[0].ScopeID)
}

func TestProcess_GetReleaseTargetsError(t *testing.T) {
	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{},
		releaseErr: errors.New("release target query failed"),
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter, queue: &mockQueue{}}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get release targets")
}

func TestProcess_EnqueueError(t *testing.T) {
	deploymentID := uuid.New()
	getter := &mockGetter{
		deployment: makeDeployment("true"),
		resources:  []ResourceInfo{},
		releaseTargets: []ReleaseTarget{
			{DeploymentID: deploymentID, EnvironmentID: uuid.New(), ResourceID: uuid.New()},
		},
	}
	setter := &mockSetter{}
	q := &mockQueue{err: errors.New("enqueue failed")}
	c := &Controller{getter: getter, setter: setter, queue: q}

	_, err := c.Process(context.Background(), processItem(deploymentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "enqueue release target")
}

func TestProcess_NoReleaseTargetsNoEnqueue(t *testing.T) {
	getter := &mockGetter{
		deployment:     makeDeployment("true"),
		resources:      []ResourceInfo{makeResource("node-1", "Node")},
		releaseTargets: nil,
	}
	setter := &mockSetter{}
	q := &mockQueue{}
	c := &Controller{getter: getter, setter: setter, queue: q}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Empty(t, q.enqueued)
}
