package jobagents

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
)

type fakeDispatcher struct {
	dispatchedContexts []types.DispatchContext
}

func (f *fakeDispatcher) Type() string {
	return "fake"
}

func (f *fakeDispatcher) Dispatch(ctx context.Context, dc types.DispatchContext) error {
	f.dispatchedContexts = append(f.dispatchedContexts, dc)
	return nil
}

func newTestRegistry(s *store.Store) (*Registry, *fakeDispatcher) {
	fake := &fakeDispatcher{}
	r := &Registry{
		dispatchers: make(map[string]types.Dispatchable),
		store:       s,
	}
	r.Register(fake)
	return r, fake
}

func newTestStore() *store.Store {
	return store.New("test-workspace", statechange.NewChangeSet[any]())
}

func TestDeepMerge_BasicMerge(t *testing.T) {
	dst := map[string]any{"a": "1"}
	src := map[string]any{"b": "2"}
	deepMerge(dst, src)

	assert.Equal(t, "1", dst["a"])
	assert.Equal(t, "2", dst["b"])
}

func TestDeepMerge_OverridesScalarValues(t *testing.T) {
	dst := map[string]any{"a": "old"}
	src := map[string]any{"a": "new"}
	deepMerge(dst, src)

	assert.Equal(t, "new", dst["a"])
}

func TestDeepMerge_NestedMapsAreMergedRecursively(t *testing.T) {
	dst := map[string]any{
		"nested": map[string]any{
			"keep": "yes",
			"old":  "value",
		},
	}
	src := map[string]any{
		"nested": map[string]any{
			"old": "updated",
			"new": "added",
		},
	}
	deepMerge(dst, src)

	nested := dst["nested"].(map[string]any)
	assert.Equal(t, "yes", nested["keep"])
	assert.Equal(t, "updated", nested["old"])
	assert.Equal(t, "added", nested["new"])
}

func TestDeepMerge_ScalarOverridesNestedMap(t *testing.T) {
	dst := map[string]any{
		"key": map[string]any{"a": "1"},
	}
	src := map[string]any{
		"key": "scalar",
	}
	deepMerge(dst, src)

	assert.Equal(t, "scalar", dst["key"])
}

func TestDeepMerge_NestedMapOverridesScalar(t *testing.T) {
	dst := map[string]any{
		"key": "scalar",
	}
	src := map[string]any{
		"key": map[string]any{"a": "1"},
	}
	deepMerge(dst, src)

	assert.Equal(t, map[string]any{"a": "1"}, dst["key"])
}

func TestDeepMerge_NilSource(t *testing.T) {
	dst := map[string]any{"a": "1"}
	deepMerge(dst, nil)

	assert.Equal(t, "1", dst["a"])
	assert.Len(t, dst, 1)
}

func TestMergeJobAgentConfig_SingleConfig(t *testing.T) {
	config := oapi.JobAgentConfig{"key": "value"}

	merged, err := mergeJobAgentConfig(config)

	assert.NoError(t, err)
	assert.Equal(t, "value", merged["key"])
}

func TestMergeJobAgentConfig_LaterConfigsOverrideEarlier(t *testing.T) {
	base := oapi.JobAgentConfig{"shared": "base", "base_only": "yes"}
	override := oapi.JobAgentConfig{"shared": "override", "override_only": "yes"}

	merged, err := mergeJobAgentConfig(base, override)

	assert.NoError(t, err)
	assert.Equal(t, "override", merged["shared"])
	assert.Equal(t, "yes", merged["base_only"])
	assert.Equal(t, "yes", merged["override_only"])
}

func TestMergeJobAgentConfig_ThreeConfigs(t *testing.T) {
	first := oapi.JobAgentConfig{"a": "1", "shared": "first"}
	second := oapi.JobAgentConfig{"b": "2", "shared": "second"}
	third := oapi.JobAgentConfig{"c": "3", "shared": "third"}

	merged, err := mergeJobAgentConfig(first, second, third)

	assert.NoError(t, err)
	assert.Equal(t, "1", merged["a"])
	assert.Equal(t, "2", merged["b"])
	assert.Equal(t, "3", merged["c"])
	assert.Equal(t, "third", merged["shared"])
}

func TestMergeJobAgentConfig_EmptyConfigs(t *testing.T) {
	merged, err := mergeJobAgentConfig(oapi.JobAgentConfig{}, oapi.JobAgentConfig{})

	assert.NoError(t, err)
	assert.Empty(t, merged)
}

func TestMergeJobAgentConfig_NilConfigs(t *testing.T) {
	merged, err := mergeJobAgentConfig(nil, oapi.JobAgentConfig{"a": "1"}, nil)

	assert.NoError(t, err)
	assert.Equal(t, "1", merged["a"])
}

func TestFillReleaseContext_NoReleaseId(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	job := &oapi.Job{Id: "job-1", ReleaseId: ""}
	dispatchCtx := &types.DispatchContext{}

	err := r.fillReleaseContext(job, dispatchCtx)

	assert.NoError(t, err)
	assert.Nil(t, dispatchCtx.Release)
	assert.Nil(t, dispatchCtx.Deployment)
	assert.Nil(t, dispatchCtx.Environment)
	assert.Nil(t, dispatchCtx.Resource)
}

func TestFillReleaseContext_PopulatesAllFields(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, _ := newTestRegistry(s)

	env := &oapi.Environment{Id: "env-1", Name: "production", SystemId: "sys-1"}
	dep := &oapi.Deployment{Id: "dep-1", Name: "api", SystemId: "sys-1", Metadata: map[string]string{}, JobAgentConfig: oapi.JobAgentConfig{}}
	res := &oapi.Resource{
		Id: "res-1", Name: "cluster", Kind: "kubernetes", Identifier: "cluster-1",
		Version: "v1", WorkspaceId: "test-workspace",
		Config: map[string]interface{}{}, Metadata: map[string]string{},
		CreatedAt: time.Now(),
	}
	s.Environments.Upsert(ctx, env)
	s.Deployments.Upsert(ctx, dep)
	s.Resources.Upsert(ctx, res)

	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			EnvironmentId: "env-1",
			DeploymentId:  "dep-1",
			ResourceId:    "res-1",
		},
		Version:   oapi.DeploymentVersion{Id: "ver-1", Tag: "v1.0.0"},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, release)

	job := &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusPending,
		Metadata:  map[string]string{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.Jobs.Upsert(ctx, job)

	dispatchCtx := &types.DispatchContext{}
	err := r.fillReleaseContext(job, dispatchCtx)

	assert.NoError(t, err)
	assert.NotNil(t, dispatchCtx.Release)
	assert.Equal(t, "env-1", dispatchCtx.Release.ReleaseTarget.EnvironmentId)
	assert.NotNil(t, dispatchCtx.Deployment)
	assert.Equal(t, "dep-1", dispatchCtx.Deployment.Id)
	assert.NotNil(t, dispatchCtx.Environment)
	assert.Equal(t, "env-1", dispatchCtx.Environment.Id)
	assert.NotNil(t, dispatchCtx.Resource)
	assert.Equal(t, "res-1", dispatchCtx.Resource.Id)
}

func TestFillWorkflowContext_NoWorkflowJobId(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	job := &oapi.Job{Id: "job-1", WorkflowJobId: ""}
	dispatchCtx := &types.DispatchContext{}

	err := r.fillWorkflowContext(job, dispatchCtx)

	assert.NoError(t, err)
	assert.Nil(t, dispatchCtx.WorkflowJob)
	assert.Nil(t, dispatchCtx.WorkflowRun)
}

func TestFillWorkflowContext_PopulatesWorkflowRunAndJob(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, _ := newTestRegistry(s)

	workflowRun := &oapi.WorkflowRun{
		Id:         "wf-run-1",
		WorkflowId: "wf-1",
		Inputs:     map[string]interface{}{"version": "1.0"},
	}
	s.WorkflowRuns.Upsert(ctx, workflowRun)

	workflowJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Ref:           "fake",
		Index:         0,
		Config:        map[string]interface{}{},
	}
	s.WorkflowJobs.Upsert(ctx, workflowJob)

	job := &oapi.Job{Id: "job-1", WorkflowJobId: "wf-job-1"}
	dispatchCtx := &types.DispatchContext{}

	err := r.fillWorkflowContext(job, dispatchCtx)

	assert.NoError(t, err)
	assert.NotNil(t, dispatchCtx.WorkflowJob)
	assert.Equal(t, "wf-job-1", dispatchCtx.WorkflowJob.Id)
	assert.NotNil(t, dispatchCtx.WorkflowRun)
	assert.Equal(t, "wf-run-1", dispatchCtx.WorkflowRun.Id)
	assert.Equal(t, map[string]interface{}{"version": "1.0"}, dispatchCtx.WorkflowRun.Inputs)
}

func TestFillWorkflowContext_WorkflowJobNotFound(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	job := &oapi.Job{Id: "job-1", WorkflowJobId: "nonexistent"}
	dispatchCtx := &types.DispatchContext{}

	err := r.fillWorkflowContext(job, dispatchCtx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "workflow job not found")
}

func TestFillWorkflowContext_WorkflowRunNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, _ := newTestRegistry(s)

	workflowJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "nonexistent-run",
		Ref:           "fake",
		Index:         0,
		Config:        map[string]interface{}{},
	}
	s.WorkflowJobs.Upsert(ctx, workflowJob)

	job := &oapi.Job{Id: "job-1", WorkflowJobId: "wf-job-1"}
	dispatchCtx := &types.DispatchContext{}

	err := r.fillWorkflowContext(job, dispatchCtx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "workflow run not found")
}

func TestGetMergedJobAgentConfig_AgentConfigOnly(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Config: oapi.JobAgentConfig{"agent_key": "agent_value"},
	}
	dispatchCtx := &types.DispatchContext{}

	merged, err := r.getMergedJobAgentConfig(agent, dispatchCtx)

	assert.NoError(t, err)
	assert.Equal(t, "agent_value", merged["agent_key"])
}

func TestGetMergedJobAgentConfig_WithWorkflowJobConfig(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Config: oapi.JobAgentConfig{"shared": "agent", "agent_only": "yes"},
	}
	dispatchCtx := &types.DispatchContext{
		WorkflowJob: &oapi.WorkflowJob{
			Config: map[string]interface{}{"shared": "workflow", "wf_only": "yes"},
		},
	}

	merged, err := r.getMergedJobAgentConfig(agent, dispatchCtx)

	assert.NoError(t, err)
	assert.Equal(t, "workflow", merged["shared"])
	assert.Equal(t, "yes", merged["agent_only"])
	assert.Equal(t, "yes", merged["wf_only"])
}

func TestGetMergedJobAgentConfig_WithDeploymentConfig(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Config: oapi.JobAgentConfig{"shared": "agent"},
	}
	dispatchCtx := &types.DispatchContext{
		Deployment: &oapi.Deployment{
			JobAgentConfig: oapi.JobAgentConfig{"shared": "deployment", "deploy_only": "yes"},
		},
	}

	merged, err := r.getMergedJobAgentConfig(agent, dispatchCtx)

	assert.NoError(t, err)
	assert.Equal(t, "deployment", merged["shared"])
	assert.Equal(t, "yes", merged["deploy_only"])
}

func TestGetMergedJobAgentConfig_AllSourcesMergeInOrder(t *testing.T) {
	// Priority (lowest → highest): agent → deployment → workflow → version
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Config: oapi.JobAgentConfig{"shared": "agent", "agent_only": "a"},
	}
	dispatchCtx := &types.DispatchContext{
		WorkflowJob: &oapi.WorkflowJob{
			Config: map[string]interface{}{"shared": "workflow", "wf_only": "w", "wf_deploy_shared": "workflow"},
		},
		Deployment: &oapi.Deployment{
			JobAgentConfig: oapi.JobAgentConfig{"shared": "deployment", "deploy_only": "d", "wf_deploy_shared": "deployment"},
		},
		Version: &oapi.DeploymentVersion{
			JobAgentConfig: oapi.JobAgentConfig{"shared": "version", "version_only": "v"},
		},
	}

	merged, err := r.getMergedJobAgentConfig(agent, dispatchCtx)

	assert.NoError(t, err)
	assert.Equal(t, "version", merged["shared"])
	assert.Equal(t, "a", merged["agent_only"])
	assert.Equal(t, "w", merged["wf_only"])
	assert.Equal(t, "d", merged["deploy_only"])
	assert.Equal(t, "v", merged["version_only"])
	assert.Equal(t, "workflow", merged["wf_deploy_shared"],
		"workflow job config should override deployment config")
}

func TestGetMergedJobAgentConfig_NilWorkflowJobAndDeployment(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Config: oapi.JobAgentConfig{"key": "value"},
	}
	dispatchCtx := &types.DispatchContext{}

	merged, err := r.getMergedJobAgentConfig(agent, dispatchCtx)

	assert.NoError(t, err)
	assert.Equal(t, "value", merged["key"])
	assert.Len(t, merged, 1)
}

func TestGetMergedJobAgentConfig_DeepMergeNestedConfigs(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Config: oapi.JobAgentConfig{
			"nested": map[string]any{"agent_key": "agent_val", "shared_key": "agent"},
		},
	}
	dispatchCtx := &types.DispatchContext{
		WorkflowJob: &oapi.WorkflowJob{
			Config: map[string]interface{}{
				"nested": map[string]any{"wf_key": "wf_val", "shared_key": "workflow"},
			},
		},
	}

	merged, err := r.getMergedJobAgentConfig(agent, dispatchCtx)

	assert.NoError(t, err)
	nested := merged["nested"].(map[string]any)
	assert.Equal(t, "agent_val", nested["agent_key"])
	assert.Equal(t, "wf_val", nested["wf_key"])
	assert.Equal(t, "workflow", nested["shared_key"])
}

func TestDispatch_JobAgentNotFound(t *testing.T) {
	s := newTestStore()
	r, _ := newTestRegistry(s)

	job := &oapi.Job{Id: "job-1", JobAgentId: "nonexistent"}

	err := r.Dispatch(context.Background(), job)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "job agent")
	assert.Contains(t, err.Error(), "not found")
}

func TestDispatch_DispatcherTypeNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{Id: "agent-1", Name: "agent-1", Type: "unknown-type", Config: oapi.JobAgentConfig{}}
	s.JobAgents.Upsert(ctx, agent)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1",
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}

	err := r.Dispatch(ctx, job)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "job agent type")
	assert.Contains(t, err.Error(), "not found")
}

func TestDispatch_WorkflowJobContextPassedToDispatcher(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, fake := newTestRegistry(s)

	agent := &oapi.JobAgent{Id: "agent-1", Name: "agent-1", Type: "fake", Config: oapi.JobAgentConfig{"base": "config"}}
	s.JobAgents.Upsert(ctx, agent)

	workflowRun := &oapi.WorkflowRun{Id: "wf-run-1", WorkflowId: "wf-1", Inputs: map[string]interface{}{"env": "prod"}}
	s.WorkflowRuns.Upsert(ctx, workflowRun)

	workflowJob := &oapi.WorkflowJob{
		Id: "wf-job-1", WorkflowRunId: "wf-run-1", Ref: "agent-1", Index: 0,
		Config: map[string]interface{}{"job_key": "job_val"},
	}
	s.WorkflowJobs.Upsert(ctx, workflowJob)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1", WorkflowJobId: "wf-job-1",
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}

	err := r.Dispatch(ctx, job)

	assert.NoError(t, err)
	assert.Len(t, fake.dispatchedContexts, 1)

	dc := fake.dispatchedContexts[0]
	assert.Equal(t, "job-1", dc.Job.Id)
	assert.Equal(t, "agent-1", dc.JobAgent.Id)
	assert.NotNil(t, dc.WorkflowJob)
	assert.Equal(t, "wf-job-1", dc.WorkflowJob.Id)
	assert.NotNil(t, dc.WorkflowRun)
	assert.Equal(t, "wf-run-1", dc.WorkflowRun.Id)
}

func TestDispatch_MergedConfigPassedToDispatcher(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, fake := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Id: "agent-1", Name: "agent-1", Type: "fake",
		Config: oapi.JobAgentConfig{"agent_key": "agent_val", "shared": "agent"},
	}
	s.JobAgents.Upsert(ctx, agent)

	workflowRun := &oapi.WorkflowRun{Id: "wf-run-1", WorkflowId: "wf-1", Inputs: map[string]interface{}{}}
	s.WorkflowRuns.Upsert(ctx, workflowRun)

	workflowJob := &oapi.WorkflowJob{
		Id: "wf-job-1", WorkflowRunId: "wf-run-1", Ref: "agent-1", Index: 0,
		Config: map[string]interface{}{"wf_key": "wf_val", "shared": "workflow"},
	}
	s.WorkflowJobs.Upsert(ctx, workflowJob)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1", WorkflowJobId: "wf-job-1",
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}

	err := r.Dispatch(ctx, job)

	assert.NoError(t, err)
	dc := fake.dispatchedContexts[0]
	assert.Equal(t, "agent_val", dc.JobAgentConfig["agent_key"])
	assert.Equal(t, "wf_val", dc.JobAgentConfig["wf_key"])
	assert.Equal(t, "workflow", dc.JobAgentConfig["shared"])
}

func TestDispatch_NoWorkflowNoRelease(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, fake := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Id: "agent-1", Name: "agent-1", Type: "fake",
		Config: oapi.JobAgentConfig{"key": "value"},
	}
	s.JobAgents.Upsert(ctx, agent)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1",
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}

	err := r.Dispatch(ctx, job)

	assert.NoError(t, err)
	assert.Len(t, fake.dispatchedContexts, 1)

	dc := fake.dispatchedContexts[0]
	assert.Nil(t, dc.Release)
	assert.Nil(t, dc.Deployment)
	assert.Nil(t, dc.Environment)
	assert.Nil(t, dc.Resource)
	assert.Nil(t, dc.WorkflowJob)
	assert.Nil(t, dc.WorkflowRun)
	assert.Equal(t, "value", dc.JobAgentConfig["key"])
}

func TestDispatch_UpsertJobInStore(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, _ := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Id: "agent-1", Name: "agent-1", Type: "fake",
		Config: oapi.JobAgentConfig{},
	}
	s.JobAgents.Upsert(ctx, agent)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1",
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}

	err := r.Dispatch(ctx, job)

	assert.NoError(t, err)
	stored, ok := s.Jobs.Get("job-1")
	assert.True(t, ok)
	assert.Equal(t, "job-1", stored.Id)
}

func TestDispatch_ReleaseContextPopulated(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, fake := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Id: "agent-1", Name: "agent-1", Type: "fake",
		Config: oapi.JobAgentConfig{},
	}
	s.JobAgents.Upsert(ctx, agent)

	env := &oapi.Environment{Id: "env-1", Name: "staging", SystemId: "sys-1"}
	dep := &oapi.Deployment{
		Id: "dep-1", Name: "web", SystemId: "sys-1",
		Metadata: map[string]string{}, JobAgentConfig: oapi.JobAgentConfig{"deploy_cfg": "yes"},
	}
	res := &oapi.Resource{
		Id: "res-1", Name: "node", Kind: "vm", Identifier: "node-1",
		Version: "v1", WorkspaceId: "test-workspace",
		Config: map[string]interface{}{}, Metadata: map[string]string{},
		CreatedAt: time.Now(),
	}
	s.Environments.Upsert(ctx, env)
	s.Deployments.Upsert(ctx, dep)
	s.Resources.Upsert(ctx, res)

	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			EnvironmentId: "env-1",
			DeploymentId:  "dep-1",
			ResourceId:    "res-1",
		},
		Version:   oapi.DeploymentVersion{Id: "ver-1", Tag: "v2.0.0"},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, release)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1", ReleaseId: release.ID(),
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	s.Jobs.Upsert(ctx, job)

	err := r.Dispatch(ctx, job)

	assert.NoError(t, err)
	assert.Len(t, fake.dispatchedContexts, 1)

	dc := fake.dispatchedContexts[0]
	assert.NotNil(t, dc.Release)
	assert.NotNil(t, dc.Deployment)
	assert.Equal(t, "dep-1", dc.Deployment.Id)
	assert.NotNil(t, dc.Environment)
	assert.Equal(t, "env-1", dc.Environment.Id)
	assert.NotNil(t, dc.Resource)
	assert.Equal(t, "res-1", dc.Resource.Id)
	assert.Equal(t, "yes", dc.JobAgentConfig["deploy_cfg"])
}

func TestDispatch_VersionJobAgentConfigMergedViaFillReleaseContext(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	r, fake := newTestRegistry(s)

	agent := &oapi.JobAgent{
		Id: "agent-1", Name: "agent-1", Type: "fake",
		Config: oapi.JobAgentConfig{"shared": "agent", "agent_only": "a"},
	}
	s.JobAgents.Upsert(ctx, agent)

	env := &oapi.Environment{Id: "env-1", Name: "staging", SystemId: "sys-1"}
	dep := &oapi.Deployment{
		Id: "dep-1", Name: "web", SystemId: "sys-1",
		Metadata:       map[string]string{},
		JobAgentConfig: oapi.JobAgentConfig{"shared": "deployment", "deploy_only": "d"},
	}
	res := &oapi.Resource{
		Id: "res-1", Name: "node", Kind: "vm", Identifier: "node-1",
		Version: "v1", WorkspaceId: "test-workspace",
		Config: map[string]interface{}{}, Metadata: map[string]string{},
		CreatedAt: time.Now(),
	}
	s.Environments.Upsert(ctx, env)
	s.Deployments.Upsert(ctx, dep)
	s.Resources.Upsert(ctx, res)

	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			EnvironmentId: "env-1",
			DeploymentId:  "dep-1",
			ResourceId:    "res-1",
		},
		Version: oapi.DeploymentVersion{
			Id:             "ver-1",
			Tag:            "v3.0.0",
			JobAgentConfig: oapi.JobAgentConfig{"shared": "version", "version_only": "v"},
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, release)

	job := &oapi.Job{
		Id: "job-1", JobAgentId: "agent-1", ReleaseId: release.ID(),
		Status: oapi.JobStatusPending, Metadata: map[string]string{},
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	s.Jobs.Upsert(ctx, job)

	err := r.Dispatch(ctx, job)

	assert.NoError(t, err)
	assert.Len(t, fake.dispatchedContexts, 1)

	dc := fake.dispatchedContexts[0]

	// Version should be populated by fillReleaseContext, not manually set
	assert.NotNil(t, dc.Version, "fillReleaseContext should populate DispatchContext.Version from the release")
	assert.Equal(t, "ver-1", dc.Version.Id)

	// Version's JobAgentConfig should win the "shared" key (highest priority)
	assert.Equal(t, "version", dc.JobAgentConfig["shared"],
		"version JobAgentConfig should override agent and deployment configs")
	assert.Equal(t, "a", dc.JobAgentConfig["agent_only"])
	assert.Equal(t, "d", dc.JobAgentConfig["deploy_only"])
	assert.Equal(t, "v", dc.JobAgentConfig["version_only"])
}

func TestRegister_AddsDispatcher(t *testing.T) {
	s := newTestStore()
	r := &Registry{
		dispatchers: make(map[string]types.Dispatchable),
		store:       s,
	}

	fake := &fakeDispatcher{}
	r.Register(fake)

	_, ok := r.dispatchers["fake"]
	assert.True(t, ok)
}

func TestRegister_OverwritesExistingType(t *testing.T) {
	s := newTestStore()
	r := &Registry{
		dispatchers: make(map[string]types.Dispatchable),
		store:       s,
	}

	first := &fakeDispatcher{}
	second := &fakeDispatcher{}
	r.Register(first)
	r.Register(second)

	assert.Same(t, second, r.dispatchers["fake"].(*fakeDispatcher))
}
