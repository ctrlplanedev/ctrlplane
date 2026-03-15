package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/svc"
	"workspace-engine/svc/controllers/jobdispatch/jobagents"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/argo"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/testrunner"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/deploymentplanresult")

const (
	planTimeout  = 5 * time.Minute
	requeueDelay = 5 * time.Second
)

// Planner dispatches a plan request to the appropriate agent by type.
type Planner interface {
	Plan(ctx context.Context, agentType string, dispatchCtx *oapi.DispatchContext, state json.RawMessage) (*types.PlanResult, error)
}

// Store abstracts the database operations used by the controller.
type Store interface {
	GetDeploymentPlanTargetResult(ctx context.Context, id uuid.UUID) (db.DeploymentPlanTargetResult, error)
	UpdateDeploymentPlanTargetResultCompleted(ctx context.Context, arg db.UpdateDeploymentPlanTargetResultCompletedParams) error
	UpdateDeploymentPlanTargetResultState(ctx context.Context, arg db.UpdateDeploymentPlanTargetResultStateParams) error
}

var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	planner Planner
	store   Store
}

// NewController creates a Controller with injected dependencies.
// Use this constructor in tests to inject mock implementations.
func NewController(planner Planner, store Store) *Controller {
	return &Controller{planner: planner, store: store}
}

// Process executes a single plan-result work item by calling the appropriate
// agent's Plan method with the snapshotted dispatch context and persisted
// agent state. Incomplete results are requeued; completed results are written
// back to the database.
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "deploymentplanresult.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.scope_id", item.ScopeID),
	)

	resultID, err := uuid.Parse(item.ScopeID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("parse result id: %w", err)
	}

	result, err := c.store.GetDeploymentPlanTargetResult(ctx, resultID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get plan target result: %w", err)
	}

	var dispatchCtx oapi.DispatchContext
	if err := json.Unmarshal(result.DispatchContext, &dispatchCtx); err != nil {
		return reconcile.Result{}, fmt.Errorf("unmarshal dispatch context: %w", err)
	}

	agentType := dispatchCtx.JobAgent.Type
	span.SetAttributes(attribute.String("agent.type", agentType))

	planCtx, cancel := context.WithTimeout(ctx, planTimeout)
	defer cancel()

	planResult, err := c.planner.Plan(planCtx, agentType, &dispatchCtx, result.AgentState)

	if planResult == nil && err == nil {
		span.AddEvent("agent does not implement Plannable")
		if updateErr := c.store.UpdateDeploymentPlanTargetResultCompleted(ctx, db.UpdateDeploymentPlanTargetResultCompletedParams{
			ID:     resultID,
			Status: db.DeploymentPlanTargetStatusUnsupported,
		}); updateErr != nil {
			return reconcile.Result{}, fmt.Errorf("mark result unsupported: %w", updateErr)
		}
		return reconcile.Result{}, nil
	}

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		if updateErr := c.store.UpdateDeploymentPlanTargetResultCompleted(ctx, db.UpdateDeploymentPlanTargetResultCompletedParams{
			ID:     resultID,
			Status: db.DeploymentPlanTargetStatusErrored,
		}); updateErr != nil {
			return reconcile.Result{}, fmt.Errorf("mark result errored: %w (original: %w)", updateErr, err)
		}
		return reconcile.Result{}, nil
	}

	if planResult.CompletedAt == nil {
		span.AddEvent("agent needs more time, saving state and requeuing")
		if err := c.store.UpdateDeploymentPlanTargetResultState(ctx, db.UpdateDeploymentPlanTargetResultStateParams{
			ID:         resultID,
			AgentState: planResult.State,
		}); err != nil {
			return reconcile.Result{}, fmt.Errorf("save agent state: %w", err)
		}
		return reconcile.Result{RequeueAfter: requeueDelay}, nil
	}

	span.SetAttributes(attribute.Bool("result.has_changes", planResult.HasChanges))
	span.AddEvent("agent completed")

	if err := c.store.UpdateDeploymentPlanTargetResultCompleted(ctx, db.UpdateDeploymentPlanTargetResultCompletedParams{
		ID:     resultID,
		Status: db.DeploymentPlanTargetStatusCompleted,
		HasChanges: pgtype.Bool{
			Bool:  planResult.HasChanges,
			Valid: true,
		},
		ContentHash: pgtype.Text{
			String: planResult.ContentHash,
			Valid:  planResult.ContentHash != "",
		},
		Current: pgtype.Text{
			String: planResult.Current,
			Valid:  true,
		},
		Proposed: pgtype.Text{
			String: planResult.Proposed,
			Valid:  true,
		},
	}); err != nil {
		return reconcile.Result{}, fmt.Errorf("save completed result: %w", err)
	}

	return reconcile.Result{}, nil
}

// postgresStore implements Store using the sqlc-generated queries.
type postgresStore struct{}

func (s *postgresStore) GetDeploymentPlanTargetResult(ctx context.Context, id uuid.UUID) (db.DeploymentPlanTargetResult, error) {
	return db.GetQueries(ctx).GetDeploymentPlanTargetResult(ctx, id)
}

func (s *postgresStore) UpdateDeploymentPlanTargetResultCompleted(ctx context.Context, arg db.UpdateDeploymentPlanTargetResultCompletedParams) error {
	return db.GetQueries(ctx).UpdateDeploymentPlanTargetResultCompleted(ctx, arg)
}

func (s *postgresStore) UpdateDeploymentPlanTargetResultState(ctx context.Context, arg db.UpdateDeploymentPlanTargetResultStateParams) error {
	return db.GetQueries(ctx).UpdateDeploymentPlanTargetResultState(ctx, arg)
}

func newRegistry() *jobagents.Registry {
	registry := jobagents.NewRegistry(nil)
	registry.Register(
		argo.New(
			&argo.GoApplicationUpserter{},
			&argo.GoApplicationDeleter{},
			nil,
			&argo.GoManifestGetter{},
		),
	)
	registry.Register(testrunner.New(nil))
	return registry
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}

	log.Debug(
		"Creating deployment plan result reconcile worker",
		"maxConcurrency", runtime.GOMAXPROCS(0),
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   30 * time.Second,
		LeaseHeartbeat:  15 * time.Second,
		MaxConcurrency:  runtime.GOMAXPROCS(0),
		MaxRetryBackoff: 10 * time.Second,
	}

	kind := events.DeploymentPlanTargetResultKind
	queue := postgres.NewForKinds(pgxPool, kind)

	controller := &Controller{
		planner: newRegistry(),
		store:   &postgresStore{},
	}

	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create deployment plan result reconcile worker", "error", err)
	}

	return worker
}
