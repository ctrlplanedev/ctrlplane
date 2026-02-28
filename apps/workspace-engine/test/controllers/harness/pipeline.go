package harness

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"
	"workspace-engine/svc/controllers/desiredrelease"

	"github.com/google/uuid"
)

const (
	KindSelectorEval   = "deployment-resource-selector-eval"
	KindDesiredRelease = "desired-release"
)

// TestPipeline wires the deployment-resource-selector-eval and
// desired-release controllers together through a shared queue (in-memory
// by default, Postgres when USE_DATABASE_BACKING is set), making it easy
// to test cross-controller flows.
type TestPipeline struct {
	t *testing.T

	selectorCtrl   reconcile.Processor
	selectorQueue  reconcile.Queue
	SelectorGetter *SelectorEvalGetter
	SelectorSetter *SelectorEvalSetter

	releaseCtrl   reconcile.Processor
	releaseQueue  reconcile.Queue
	ReleaseGetter *DesiredReleaseGetter
	ReleaseSetter *DesiredReleaseSetter

	// Scenario holds the declarative configuration built by PipelineOptions.
	Scenario *ScenarioState

	// dbBacked is true when the pipeline uses a Postgres reconcile queue.
	dbBacked bool

	// seeded tracks whether the initial selector-eval item has been enqueued,
	// allowing Run() to be called multiple times without double-seeding.
	seeded bool

	// requeues accumulates items that were re-enqueued with a future NotBefore
	// during Run/RunRound processing.
	requeues []RequeueRecord
}

// ScenarioState accumulates the entities declared via options so the
// pipeline can wire the mocks consistently.
type ScenarioState struct {
	WorkspaceID  uuid.UUID
	DeploymentID uuid.UUID

	DeploymentSelector string
	DeploymentName     string
	DeploymentRaw      map[string]any

	EnvironmentID   uuid.UUID
	EnvironmentName string

	Resources   []ResourceDef
	Versions    []*oapi.DeploymentVersion
	Policies    []*oapi.Policy
	PolicySkips []*oapi.PolicySkip

	DeploymentVars  []oapi.DeploymentVariableWithValues
	ResourceVars    map[string]oapi.ResourceVariable
	RelatedEntities map[string][]*oapi.EntityRelation
}

type ResourceDef struct {
	ID       uuid.UUID
	Name     string
	Kind     string
	Labels   map[string]any
	Metadata map[string]any
}

// NewTestPipeline constructs a TestPipeline with mock getters/setters.
// By default it uses an in-memory reconcile queue; set the
// USE_DATABASE_BACKING env var to use a real Postgres-backed queue instead.
// Pass PipelineOption values to declaratively configure the scenario.
func NewTestPipeline(t *testing.T, opts ...PipelineOption) *TestPipeline {
	t.Helper()

	sc := &ScenarioState{
		WorkspaceID:        uuid.New(),
		DeploymentID:       uuid.New(),
		DeploymentSelector: "true",
		DeploymentName:     "test-deployment",
		DeploymentRaw:      map[string]any{"name": "test-deployment", "metadata": map[string]any{}},

		EnvironmentID:   uuid.New(),
		EnvironmentName: "default",
	}

	for _, opt := range opts {
		opt(sc)
	}

	releaseTargets := buildReleaseTargets(sc)

	selectorGetter := &SelectorEvalGetter{
		Deployment: &selectoreval.DeploymentInfo{
			ResourceSelector: sc.DeploymentSelector,
			WorkspaceID:      sc.WorkspaceID,
			Raw:              sc.DeploymentRaw,
		},
		Resources:      buildSelectorResources(sc),
		ReleaseTargets: releaseTargets,
	}
	selectorSetter := &SelectorEvalSetter{}

	scope := buildEvaluatorScope(sc)
	releaseGetter := &DesiredReleaseGetter{
		Scope:          scope,
		Versions:       sc.Versions,
		Policies:       sc.Policies,
		PolicySkips:    sc.PolicySkips,
		DeploymentVars: sc.DeploymentVars,
		ResourceVars:   sc.ResourceVars,
		RelatedEntity:  sc.RelatedEntities,
	}
	releaseSetter := &DesiredReleaseSetter{}

	var qs queueSet
	dbBacked := UseDBBacking()
	if dbBacked {
		pool := requireDB(t)
		qs = newPostgresQueues(t, pool, sc.WorkspaceID.String())
	} else {
		qs = newMemoryQueues()
	}

	selectorCtrl := selectoreval.NewController(selectorGetter, selectorSetter, qs.shared)
	releaseCtrl := desiredrelease.NewController(releaseGetter, releaseSetter)

	return &TestPipeline{
		t:              t,
		selectorCtrl:   selectorCtrl,
		selectorQueue:  qs.selectorQueue,
		SelectorGetter: selectorGetter,
		SelectorSetter: selectorSetter,
		releaseCtrl:    releaseCtrl,
		releaseQueue:   qs.releaseQueue,
		ReleaseGetter:  releaseGetter,
		ReleaseSetter:  releaseSetter,
		Scenario:       sc,
		dbBacked:       dbBacked,
	}
}

// EnqueueSelectorEval seeds the pipeline by enqueuing a
// deployment-resource-selector-eval item for the scenario's deployment.
func (p *TestPipeline) EnqueueSelectorEval() {
	p.t.Helper()
	err := p.selectorQueue.Enqueue(context.Background(), reconcile.EnqueueParams{
		WorkspaceID: p.Scenario.WorkspaceID.String(),
		Kind:        KindSelectorEval,
		ScopeType:   "deployment",
		ScopeID:     p.Scenario.DeploymentID.String(),
	})
	if err != nil {
		p.t.Fatalf("enqueue selector eval: %v", err)
	}
}

// ProcessSelectorEvals claims and processes all pending
// deployment-resource-selector-eval items. Returns the count processed.
func (p *TestPipeline) ProcessSelectorEvals() int {
	p.t.Helper()
	res, err := DrainQueue(context.Background(), p.selectorQueue, p.selectorCtrl)
	if err != nil {
		p.t.Fatalf("process selector evals: %v", err)
	}
	return res.Processed
}

// ProcessDesiredReleases claims and processes all pending desired-release
// items. Returns the count processed.
func (p *TestPipeline) ProcessDesiredReleases() int {
	p.t.Helper()
	res, err := DrainQueue(context.Background(), p.releaseQueue, p.releaseCtrl)
	if err != nil {
		p.t.Fatalf("process desired releases: %v", err)
	}
	return res.Processed
}

// RunPipeline is a convenience method that enqueues a selector-eval item
// and then drains both controller queues in sequence.
func (p *TestPipeline) RunPipeline() {
	p.t.Helper()
	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()
	p.ProcessDesiredReleases()
}

// ---------------------------------------------------------------------------
// Round-robin Run API
// ---------------------------------------------------------------------------

// RunOption configures a Run() or RunRound() call.
type RunOption func(*runConfig)

type runConfig struct {
	maxRounds int
}

const defaultMaxRounds = 100

// WithMaxRounds sets the maximum number of round-robin cycles before Run
// fails the test. Prevents infinite loops if a controller continuously
// requeues.
func WithMaxRounds(n int) RunOption {
	return func(c *runConfig) { c.maxRounds = n }
}

// Run enqueues the seed selector-eval item (on first call) and then
// round-robin drains all controller queues until a full cycle produces
// zero items. Callable multiple times -- subsequent calls skip the
// seed enqueue and simply drain whatever new work exists.
//
// Requeued items (those with a future NotBefore) are tracked and can be
// inspected via PendingRequeues() or force-processed via
// ForceProcessRequeues().
func (p *TestPipeline) Run(opts ...RunOption) {
	p.t.Helper()

	cfg := runConfig{maxRounds: defaultMaxRounds}
	for _, o := range opts {
		o(&cfg)
	}

	if !p.seeded {
		p.EnqueueSelectorEval()
		p.seeded = true
	}

	for round := 0; round < cfg.maxRounds; round++ {
		n := p.RunRound()
		if n == 0 {
			return
		}
	}
	p.t.Fatalf("Run: pipeline did not settle after %d rounds", cfg.maxRounds)
}

// RunRound performs a single round-robin cycle: drain the selector-eval
// queue, then drain the desired-release queue. Returns the total number of
// items processed across both queues. Requeue records are accumulated in
// PendingRequeues().
func (p *TestPipeline) RunRound() int {
	p.t.Helper()
	ctx := context.Background()
	total := 0

	sRes, err := DrainQueue(ctx, p.selectorQueue, p.selectorCtrl)
	if err != nil {
		p.t.Fatalf("RunRound selector-eval: %v", err)
	}
	total += sRes.Processed
	p.requeues = append(p.requeues, sRes.Requeued...)

	rRes, err := DrainQueue(ctx, p.releaseQueue, p.releaseCtrl)
	if err != nil {
		p.t.Fatalf("RunRound desired-release: %v", err)
	}
	total += rRes.Processed
	p.requeues = append(p.requeues, rRes.Requeued...)

	return total
}

// PendingRequeues returns records for items that were re-enqueued with a
// future NotBefore during Run/RunRound processing. These items were
// deferred and not processed in the current cycle.
func (p *TestPipeline) PendingRequeues() []RequeueRecord {
	return p.requeues
}

// ForceProcessRequeues re-enqueues all pending requeue records with an
// immediate NotBefore and drains all queues until settled. This simulates
// time advancing past the requeue delay.
func (p *TestPipeline) ForceProcessRequeues(opts ...RunOption) {
	p.t.Helper()

	cfg := runConfig{maxRounds: defaultMaxRounds}
	for _, o := range opts {
		o(&cfg)
	}

	ctx := context.Background()
	for _, rq := range p.requeues {
		queue := p.queueForKind(rq.Kind)
		if err := queue.Enqueue(ctx, reconcile.EnqueueParams{
			WorkspaceID: rq.WorkspaceID,
			Kind:        rq.Kind,
			ScopeType:   rq.ScopeType,
			ScopeID:     rq.ScopeID,
		}); err != nil {
			p.t.Fatalf("ForceProcessRequeues enqueue %s: %v", rq.Kind, err)
		}
	}
	p.requeues = nil

	for round := 0; round < cfg.maxRounds; round++ {
		n := p.RunRound()
		if n == 0 {
			return
		}
	}
	p.t.Fatalf("ForceProcessRequeues: did not settle after %d rounds", cfg.maxRounds)
}

func (p *TestPipeline) queueForKind(kind string) reconcile.Queue {
	switch kind {
	case KindSelectorEval:
		return p.selectorQueue
	case KindDesiredRelease:
		return p.releaseQueue
	default:
		p.t.Fatalf("unknown kind: %s", kind)
		return nil
	}
}

// IsDBBacked reports whether this pipeline is using a Postgres reconcile queue.
func (p *TestPipeline) IsDBBacked() bool {
	return p.dbBacked
}

// Releases returns the releases captured by the desired-release setter.
func (p *TestPipeline) Releases() []*oapi.Release {
	return p.ReleaseSetter.Releases
}

// ComputedResources returns the resource IDs written by the selector-eval setter.
func (p *TestPipeline) ComputedResources() []uuid.UUID {
	return p.SelectorSetter.ComputedResources
}

// WorkspaceID returns the auto-generated workspace UUID for the scenario.
func (p *TestPipeline) WorkspaceID() uuid.UUID {
	return p.Scenario.WorkspaceID
}

// DeploymentID returns the auto-generated deployment UUID for the scenario.
func (p *TestPipeline) DeploymentID() uuid.UUID {
	return p.Scenario.DeploymentID
}

// EnvironmentID returns the auto-generated environment UUID for the scenario.
func (p *TestPipeline) EnvironmentID() uuid.UUID {
	return p.Scenario.EnvironmentID
}
