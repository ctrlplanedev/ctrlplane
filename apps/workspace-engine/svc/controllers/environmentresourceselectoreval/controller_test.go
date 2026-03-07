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
// Resource pass-through tests
// ---------------------------------------------------------------------------

func TestProcess_PassesThroughAllResources(t *testing.T) {
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
