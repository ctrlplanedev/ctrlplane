package releasemanager

import (
	"context"
	"sync"
	"time"

	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/targets"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
)

// Manager handles the business logic for release target changes and deployment decisions.
// It orchestrates deployment planning, execution, and job management.
type Manager struct {
	store *store.Store

	// Sub-managers
	targetsManager *targets.Manager

	// Deployment components
	planner  *deployment.Planner
	executor *deployment.Executor

	// Concurrency control
	releaseTargetLocks sync.Map
}

var tracer = otel.Tracer("workspace/releasemanager")

// New creates a new release manager for a workspace.
func New(store *store.Store) *Manager {
	targetsManager := targets.New(store)
	policyManager := policy.New(store)
	versionManager := versions.New(store)
	variableManager := variables.New(store)

	return &Manager{
		store:              store,
		targetsManager:     targetsManager,
		planner:            deployment.NewPlanner(policyManager, versionManager, variableManager),
		executor:           deployment.NewExecutor(store),
		releaseTargetLocks: sync.Map{},
	}
}

// ============================================================================
// Public API
// ============================================================================

// ProcessChanges handles detected changes to release targets (WRITES TO STORE).
// Reconciles added/tainted targets (triggers deployments) and removes deleted targets.
// Returns a map of cancelled jobs (for removed targets).
func (m *Manager) ProcessChanges(ctx context.Context, changes *changeset.ChangeSet[any]) (cmap.ConcurrentMap[string, *oapi.Job], error) {
	ctx, span := tracer.Start(ctx, "ProcessChanges")
	defer span.End()

	targetChanges, err := m.targetsManager.DetectChanges(ctx, changes)
	if err != nil {
		log.Error("error detecting changes to release targets", "error", err.Error())
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to detect changes to release targets")
		return cmap.New[*oapi.Job](), err
	}

	if err := m.targetsManager.RefreshTargets(ctx); err != nil {
		log.Error("error refreshing targets cache", "error", err.Error())
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to refresh targets cache")
		return cmap.New[*oapi.Job](), err
	}

	cancelledJobs := cmap.New[*oapi.Job]()
	var wg sync.WaitGroup

	added := targetChanges.Process().FilterByType(changeset.ChangeTypeCreate).CollectEntities()
	tainted := targetChanges.Process().FilterByType(changeset.ChangeTypeTaint).CollectEntities()
	removed := targetChanges.Process().FilterByType(changeset.ChangeTypeDelete).CollectEntities()
	allToProcess := append(added, tainted...)

	targetChanges.Finalize()
	for _, change := range targetChanges.Changes {
		changes.Record(change.Type, change.Entity)
	}

	// Process added/tainted release targets
	for _, rt := range allToProcess {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			if err := m.reconcileTarget(ctx, target); err != nil {
				log.Warn("error reconciling release target", "error", err.Error())
			}
		}(rt)
	}

	// Cancel jobs for removed release targets
	for _, rt := range removed {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(target) {
				if job != nil {
					job.Status = oapi.Cancelled
					job.UpdatedAt = time.Now()
					cancelledJobs.Set(job.Id, job)
				}
			}
		}(rt)
	}

	wg.Wait()

	cancelledJobs.IterCb(func(_ string, job *oapi.Job) {
		changes.Record(changeset.ChangeTypeUpdate, job)
	})

	return cancelledJobs, nil
}

// reconcileTarget ensures a release target is in its desired state (WRITES TO STORE).
// Uses the two-phase deployment pattern: planning (read-only) and execution (writes).
//
// Two-Phase Design:
//
//	Phase 1 (DECISION): planner.PlanDeployment() answers "What needs deploying?" (read-only)
//	Phase 2 (ACTION):   executor.ExecuteRelease() creates the job and deploys (writes)
//
// If planning returns nil → Nothing to deploy (already deployed, no versions, or blocked)
// If planning returns release → Deploy it (planning phase already validated everything)
func (m *Manager) reconcileTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error {
	ctx, span := tracer.Start(ctx, "ReconcileTarget")
	defer span.End()

	targetKey := releaseTarget.Key()
	lockInterface, _ := m.releaseTargetLocks.LoadOrStore(targetKey, &sync.Mutex{})
	lock := lockInterface.(*sync.Mutex)

	// Serialize processing for this specific release target
	lock.Lock()
	defer lock.Unlock()

	// Phase 1: DECISION - What needs deploying? (READ-ONLY)
	releaseToDeploy, err := m.planner.PlanDeployment(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return err
	}

	// Nothing to deploy
	if releaseToDeploy == nil {
		return nil
	}

	// Phase 2: ACTION - Deploy it (WRITES)
	return m.executor.ExecuteRelease(ctx, releaseToDeploy)
}
