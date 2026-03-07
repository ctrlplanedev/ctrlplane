package environmentresourceselectoreval

import (
	"context"
	"errors"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/store/resources"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

type mockGetter struct {
	environment *EnvironmentInfo
	envErr      error
	resources   []*oapi.Resource
	listErr     error
}

func (m *mockGetter) GetEnvironmentInfo(_ context.Context, _ uuid.UUID) (*EnvironmentInfo, error) {
	return m.environment, m.envErr
}

func (m *mockGetter) GetResources(_ context.Context, _ string, _ resources.GetResourcesOptions) ([]*oapi.Resource, error) {
	return m.resources, m.listErr
}

type mockSetter struct {
	calledWith struct {
		environmentID uuid.UUID
		resourceIDs   []uuid.UUID
	}
	err error
}

func (m *mockSetter) SetComputedEnvironmentResources(_ context.Context, environmentID uuid.UUID, resourceIDs []uuid.UUID) error {
	m.calledWith.environmentID = environmentID
	m.calledWith.resourceIDs = resourceIDs
	return m.err
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func makeResource(name, kind string) *oapi.Resource {
	return &oapi.Resource{
		Id:       uuid.New().String(),
		Name:     name,
		Kind:     kind,
		Metadata: map[string]string{},
	}
}

func makeResourceWithLabels(name, kind string, labels map[string]string) *oapi.Resource {
	return &oapi.Resource{
		Id:       uuid.New().String(),
		Name:     name,
		Kind:     kind,
		Metadata: labels,
	}
}

func resourceID(r *oapi.Resource) uuid.UUID {
	return uuid.MustParse(r.Id)
}

func makeEnvironment(selector string) *EnvironmentInfo {
	return &EnvironmentInfo{
		ResourceSelector: selector,
		WorkspaceID:      uuid.New(),
	}
}

func processItem(scopeID string) reconcile.Item {
	return reconcile.Item{
		ID:        1,
		Kind:      "environment-resource-selector-eval",
		ScopeType: "environment",
		ScopeID:   scopeID,
		EventTS:   time.Now(),
	}
}

// ---------------------------------------------------------------------------
// Process tests
// ---------------------------------------------------------------------------

func TestProcess_InvalidScopeID(t *testing.T) {
	c := &Controller{getter: &mockGetter{}, setter: &mockSetter{}}
	_, err := c.Process(context.Background(), processItem("not-a-uuid"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse environment id")
}

func TestProcess_GetEnvironmentError(t *testing.T) {
	environmentID := uuid.New()
	getter := &mockGetter{envErr: errors.New("db down")}
	c := &Controller{getter: getter, setter: &mockSetter{}}

	_, err := c.Process(context.Background(), processItem(environmentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "db down")
}

func TestProcess_InvalidSelector(t *testing.T) {
	environmentID := uuid.New()
	getter := &mockGetter{
		environment: &EnvironmentInfo{
			ResourceSelector: ">>>invalid<<<",
			WorkspaceID:      uuid.New(),
		},
	}
	c := &Controller{getter: getter, setter: &mockSetter{}}

	_, err := c.Process(context.Background(), processItem(environmentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "compile environment selector")
}

func TestProcess_ListResourcesError(t *testing.T) {
	environmentID := uuid.New()
	getter := &mockGetter{
		environment: makeEnvironment("true"),
		listErr:     errors.New("timeout"),
	}
	c := &Controller{getter: getter, setter: &mockSetter{}}

	_, err := c.Process(context.Background(), processItem(environmentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

func TestProcess_SetterError(t *testing.T) {
	environmentID := uuid.New()
	getter := &mockGetter{
		environment: makeEnvironment("true"),
		resources:   []*oapi.Resource{makeResource("r1", "Node")},
	}
	setter := &mockSetter{err: errors.New("write failed")}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(environmentID.String()))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "set computed environment resources")
}

func TestProcess_DelegatesCorrectEnvironmentID(t *testing.T) {
	environmentID := uuid.New()
	getter := &mockGetter{
		environment: makeEnvironment("true"),
		resources:   []*oapi.Resource{},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(environmentID.String()))
	require.NoError(t, err)
	assert.Equal(t, environmentID, setter.calledWith.environmentID)
}

// ---------------------------------------------------------------------------
// Selector matching tests
// ---------------------------------------------------------------------------

func TestProcess_MatchAllResources(t *testing.T) {
	r1 := makeResource("node-1", "Node")
	r2 := makeResource("node-2", "Node")
	r3 := makeResource("pod-1", "Pod")

	getter := &mockGetter{
		environment: makeEnvironment("true"),
		resources:   []*oapi.Resource{r1, r2, r3},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 3)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r1))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r2))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r3))
}

func TestProcess_MatchNoResources(t *testing.T) {
	getter := &mockGetter{
		environment: makeEnvironment("false"),
		resources: []*oapi.Resource{
			makeResource("node-1", "Node"),
			makeResource("node-2", "Node"),
		},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Empty(t, setter.calledWith.resourceIDs)
}

func TestProcess_EmptyResourceList(t *testing.T) {
	getter := &mockGetter{
		environment: makeEnvironment("true"),
		resources:   []*oapi.Resource{},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Empty(t, setter.calledWith.resourceIDs)
}

func TestProcess_FilterByKind(t *testing.T) {
	node1 := makeResource("node-1", "Node")
	node2 := makeResource("node-2", "Node")
	pod := makeResource("pod-1", "Pod")

	getter := &mockGetter{
		environment: makeEnvironment(`resource.kind == "Node"`),
		resources:   []*oapi.Resource{node1, pod, node2},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(node1))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(node2))
}

func TestProcess_FilterByName(t *testing.T) {
	r1 := makeResource("web-server", "Pod")
	r2 := makeResource("api-server", "Pod")
	r3 := makeResource("worker", "Pod")

	getter := &mockGetter{
		environment: makeEnvironment(`resource.name.endsWith("-server")`),
		resources:   []*oapi.Resource{r1, r2, r3},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r1))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r2))
}

func TestProcess_FilterByLabel(t *testing.T) {
	gpu := makeResourceWithLabels("node-1", "Node", map[string]string{"pool": "gpu"})
	cpu := makeResourceWithLabels("node-2", "Node", map[string]string{"pool": "cpu"})
	gpu2 := makeResourceWithLabels("node-3", "Node", map[string]string{"pool": "gpu"})

	getter := &mockGetter{
		environment: makeEnvironment(`resource.metadata.pool == "gpu"`),
		resources:   []*oapi.Resource{gpu, cpu, gpu2},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(gpu))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(gpu2))
}

func TestProcess_CompoundSelector(t *testing.T) {
	match := makeResourceWithLabels("gpu-node-1", "Node", map[string]string{
		"pool": "gpu",
		"env":  "production",
	})
	wrongKind := makeResourceWithLabels("gpu-pod-1", "Pod", map[string]string{
		"pool": "gpu",
		"env":  "production",
	})
	wrongLabel := makeResourceWithLabels("cpu-node-1", "Node", map[string]string{
		"pool": "cpu",
		"env":  "production",
	})
	wrongEnv := makeResourceWithLabels("gpu-node-2", "Node", map[string]string{
		"pool": "gpu",
		"env":  "staging",
	})

	getter := &mockGetter{
		environment: makeEnvironment(
			`resource.kind == "Node" && resource.metadata.pool == "gpu" && resource.metadata.env == "production"`,
		),
		resources: []*oapi.Resource{match, wrongKind, wrongLabel, wrongEnv},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 1)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(match))
}

func TestProcess_MissingKeyReturnsNoMatch(t *testing.T) {
	withLabel := makeResourceWithLabels("node-1", "Node", map[string]string{"tier": "critical"})
	withoutLabel := makeResource("node-2", "Node")

	getter := &mockGetter{
		environment: makeEnvironment(`resource.metadata.tier == "critical"`),
		resources:   []*oapi.Resource{withLabel, withoutLabel},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 1)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(withLabel))
}

func TestProcess_NameStartsWith(t *testing.T) {
	match1 := makeResource("prod-web-1", "Pod")
	match2 := makeResource("prod-api-1", "Pod")
	noMatch := makeResource("staging-web-1", "Pod")

	getter := &mockGetter{
		environment: makeEnvironment(`resource.name.startsWith("prod-")`),
		resources:   []*oapi.Resource{match1, match2, noMatch},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(match1))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(match2))
}

func TestProcess_LargeResourceSet(t *testing.T) {
	res := make([]*oapi.Resource, 500)
	expectedIDs := make([]uuid.UUID, 0)
	for i := range res {
		kind := "Pod"
		if i%3 == 0 {
			kind = "Node"
		}
		res[i] = makeResource("r-"+uuid.New().String(), kind)
		if kind == "Node" {
			expectedIDs = append(expectedIDs, resourceID(res[i]))
		}
	}

	getter := &mockGetter{
		environment: makeEnvironment(`resource.kind == "Node"`),
		resources:   res,
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

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
		environment: makeEnvironment(`resource.kind == "Node" || resource.kind == "Pod"`),
		resources:   []*oapi.Resource{node, pod, svc},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(node))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(pod))
}

func TestProcess_NegationSelector(t *testing.T) {
	node := makeResource("node-1", "Node")
	pod := makeResource("pod-1", "Pod")
	svc := makeResource("svc-1", "Service")

	getter := &mockGetter{
		environment: makeEnvironment(`resource.kind != "Service"`),
		resources:   []*oapi.Resource{node, pod, svc},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(node))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(pod))
}

func TestProcess_InListSelector(t *testing.T) {
	r1 := makeResourceWithLabels("n1", "Node", map[string]string{"env": "prod"})
	r2 := makeResourceWithLabels("n2", "Node", map[string]string{"env": "staging"})
	r3 := makeResourceWithLabels("n3", "Node", map[string]string{"env": "dev"})

	getter := &mockGetter{
		environment: makeEnvironment(`resource.metadata.env in ["prod", "staging"]`),
		resources:   []*oapi.Resource{r1, r2, r3},
	}
	setter := &mockSetter{}
	c := &Controller{getter: getter, setter: setter}

	_, err := c.Process(context.Background(), processItem(uuid.New().String()))
	require.NoError(t, err)
	assert.Len(t, setter.calledWith.resourceIDs, 2)
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r1))
	assert.Contains(t, setter.calledWith.resourceIDs, resourceID(r2))
}
