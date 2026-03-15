package deploymentplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"time"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/svc"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/deploymentplan")

// ErrTargetExists is returned by Setter.InsertTarget when the
// (planID, environmentID, resourceID) triple already exists.
var ErrTargetExists = errors.New("target already exists")

// Getter abstracts read operations needed by the plan controller.
type Getter interface {
	GetDeploymentPlan(ctx context.Context, id uuid.UUID) (db.DeploymentPlan, error)
	GetDeployment(ctx context.Context, id uuid.UUID) (*oapi.Deployment, error)
	GetReleaseTargets(ctx context.Context, deploymentID uuid.UUID) ([]ReleaseTarget, error)
	GetEnvironment(ctx context.Context, id uuid.UUID) (*oapi.Environment, error)
	GetResource(ctx context.Context, id uuid.UUID) (*oapi.Resource, error)
	GetJobAgent(ctx context.Context, id uuid.UUID) (*oapi.JobAgent, error)
}

// ReleaseTarget identifies a single (environment, resource) pair.
type ReleaseTarget struct {
	EnvironmentID uuid.UUID
	ResourceID    uuid.UUID
}

// Setter abstracts write and enqueue operations.
type Setter interface {
	CompletePlan(ctx context.Context, planID uuid.UUID) error
	InsertTarget(ctx context.Context, planID, envID, resourceID uuid.UUID) (uuid.UUID, error)
	InsertResult(ctx context.Context, targetID uuid.UUID, dispatchContext []byte) (uuid.UUID, error)
	EnqueueResult(ctx context.Context, workspaceID, resultID string) error
}

// VarResolver resolves deployment variables for a release target.
type VarResolver interface {
	Resolve(ctx context.Context, scope *variableresolver.Scope, deploymentID, resourceID string) (map[string]oapi.LiteralValue, error)
}

var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter      Getter
	setter      Setter
	varResolver VarResolver
}

// NewController creates a Controller with injected dependencies.
// Use this constructor in tests to inject mock implementations.
func NewController(getter Getter, setter Setter, varResolver VarResolver) *Controller {
	return &Controller{getter: getter, setter: setter, varResolver: varResolver}
}

// Process fans out a deployment plan into per-agent work items for each
// release target. For each (environment, resource, agent) triple it snapshots
// the dispatch context and enqueues a plan-result work item.
func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "deploymentplan.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.scope_id", item.ScopeID),
	)

	planID, err := uuid.Parse(item.ScopeID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("parse plan id: %w", err)
	}

	plan, err := c.getter.GetDeploymentPlan(ctx, planID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get deployment plan: %w", err)
	}

	deployment, err := c.getter.GetDeployment(ctx, plan.DeploymentID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get deployment: %w", err)
	}

	if deployment.JobAgents == nil || len(*deployment.JobAgents) == 0 {
		if err := c.setter.CompletePlan(ctx, planID); err != nil {
			return reconcile.Result{}, fmt.Errorf("mark plan completed: %w", err)
		}
		return reconcile.Result{}, nil
	}

	targets, err := c.getter.GetReleaseTargets(ctx, plan.DeploymentID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get release targets: %w", err)
	}

	span.SetAttributes(attribute.Int("targets.count", len(targets)))

	if len(targets) == 0 {
		if err := c.setter.CompletePlan(ctx, planID); err != nil {
			return reconcile.Result{}, fmt.Errorf("mark plan completed: %w", err)
		}
		return reconcile.Result{}, nil
	}

	version := &oapi.DeploymentVersion{
		Id:             uuid.New().String(),
		Tag:            plan.VersionTag,
		Name:           plan.VersionName,
		Config:         plan.VersionConfig,
		JobAgentConfig: oapi.JobAgentConfig(plan.VersionJobAgentConfig),
		Metadata:       plan.VersionMetadata,
		DeploymentId:   plan.DeploymentID.String(),
		Status:         oapi.DeploymentVersionStatusReady,
		CreatedAt:      time.Now(),
	}

	for _, target := range targets {
		if err := c.processTarget(ctx, plan, deployment, version, target); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return reconcile.Result{}, err
		}
	}

	return reconcile.Result{}, nil
}

func (c *Controller) processTarget(
	ctx context.Context,
	plan db.DeploymentPlan,
	deployment *oapi.Deployment,
	version *oapi.DeploymentVersion,
	target ReleaseTarget,
) error {
	targetID, err := c.setter.InsertTarget(ctx, plan.ID, target.EnvironmentID, target.ResourceID)
	if errors.Is(err, ErrTargetExists) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("insert plan target: %w", err)
	}

	env, err := c.getter.GetEnvironment(ctx, target.EnvironmentID)
	if err != nil {
		return fmt.Errorf("get environment %s: %w", target.EnvironmentID, err)
	}

	resource, err := c.getter.GetResource(ctx, target.ResourceID)
	if err != nil {
		return fmt.Errorf("get resource %s: %w", target.ResourceID, err)
	}

	scope := &variableresolver.Scope{
		Resource:    resource,
		Deployment:  deployment,
		Environment: env,
	}
	variables, err := c.varResolver.Resolve(
		ctx, scope,
		plan.DeploymentID.String(), target.ResourceID.String(),
	)
	if err != nil {
		return fmt.Errorf("resolve variables: %w", err)
	}

	for _, agentRef := range *deployment.JobAgents {
		agentID, err := uuid.Parse(agentRef.Ref)
		if err != nil {
			return fmt.Errorf("parse agent ref: %w", err)
		}

		jobAgent, err := c.getter.GetJobAgent(ctx, agentID)
		if err != nil {
			return fmt.Errorf("get job agent %s: %w", agentRef.Ref, err)
		}

		mergedConfig := oapi.DeepMergeConfigs(
			jobAgent.Config, agentRef.Config, version.JobAgentConfig,
		)

		dispatchCtx := &oapi.DispatchContext{
			Deployment:     deployment,
			Environment:    env,
			Resource:       resource,
			Version:        version,
			Variables:      &variables,
			JobAgent:       *jobAgent,
			JobAgentConfig: mergedConfig,
		}

		dispatchJSON, err := json.Marshal(dispatchCtx)
		if err != nil {
			return fmt.Errorf("marshal dispatch context: %w", err)
		}

		resultID, err := c.setter.InsertResult(ctx, targetID, dispatchJSON)
		if err != nil {
			return fmt.Errorf("insert plan target result: %w", err)
		}

		if err := c.setter.EnqueueResult(ctx, plan.WorkspaceID.String(), resultID.String()); err != nil {
			return fmt.Errorf("enqueue plan target result: %w", err)
		}
	}

	return nil
}

// --- Postgres implementations ---

type postgresGetter struct{}

func (g *postgresGetter) GetDeploymentPlan(ctx context.Context, id uuid.UUID) (db.DeploymentPlan, error) {
	return db.GetQueries(ctx).GetDeploymentPlan(ctx, id)
}

func (g *postgresGetter) GetDeployment(ctx context.Context, id uuid.UUID) (*oapi.Deployment, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (g *postgresGetter) GetReleaseTargets(ctx context.Context, deploymentID uuid.UUID) ([]ReleaseTarget, error) {
	rows, err := db.GetQueries(ctx).GetReleaseTargetsForDeployment(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	targets := make([]ReleaseTarget, len(rows))
	for i, r := range rows {
		targets[i] = ReleaseTarget{EnvironmentID: r.EnvironmentID, ResourceID: r.ResourceID}
	}
	return targets, nil
}

func (g *postgresGetter) GetEnvironment(ctx context.Context, id uuid.UUID) (*oapi.Environment, error) {
	row, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(row), nil
}

func (g *postgresGetter) GetResource(ctx context.Context, id uuid.UUID) (*oapi.Resource, error) {
	row, err := db.GetQueries(ctx).GetResourceByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(row), nil
}

func (g *postgresGetter) GetJobAgent(ctx context.Context, id uuid.UUID) (*oapi.JobAgent, error) {
	row, err := db.GetQueries(ctx).GetJobAgentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

type postgresSetter struct {
	queue reconcile.Queue
}

func (s *postgresSetter) CompletePlan(ctx context.Context, planID uuid.UUID) error {
	return db.GetQueries(ctx).UpdateDeploymentPlanCompleted(ctx, planID)
}

func (s *postgresSetter) InsertTarget(ctx context.Context, planID, envID, resourceID uuid.UUID) (uuid.UUID, error) {
	targetID := uuid.New()
	_, err := db.GetQueries(ctx).InsertDeploymentPlanTarget(ctx, db.InsertDeploymentPlanTargetParams{
		ID:            targetID,
		PlanID:        planID,
		EnvironmentID: envID,
		ResourceID:    resourceID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.UUID{}, ErrTargetExists
	}
	if err != nil {
		return uuid.UUID{}, err
	}
	return targetID, nil
}

func (s *postgresSetter) InsertResult(ctx context.Context, targetID uuid.UUID, dispatchContext []byte) (uuid.UUID, error) {
	resultID := uuid.New()
	err := db.GetQueries(ctx).InsertDeploymentPlanTargetResult(ctx, db.InsertDeploymentPlanTargetResultParams{
		ID:              resultID,
		TargetID:        targetID,
		DispatchContext: dispatchContext,
	})
	if err != nil {
		return uuid.UUID{}, err
	}
	return resultID, nil
}

func (s *postgresSetter) EnqueueResult(ctx context.Context, workspaceID, resultID string) error {
	return events.EnqueueDeploymentPlanTargetResult(s.queue, ctx, events.DeploymentPlanTargetResultParams{
		WorkspaceID: workspaceID,
		ResultID:    resultID,
	})
}

type postgresVarResolver struct {
	getter variableresolver.Getter
}

func (r *postgresVarResolver) Resolve(ctx context.Context, scope *variableresolver.Scope, deploymentID, resourceID string) (map[string]oapi.LiteralValue, error) {
	return variableresolver.Resolve(ctx, r.getter, scope, deploymentID, resourceID)
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}

	log.Debug(
		"Creating deployment plan reconcile worker",
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

	kind := events.DeploymentPlanKind
	queue := postgres.NewForKinds(pgxPool, kind)
	enqueueQueue := postgres.New(pgxPool)

	q := db.GetQueries(context.Background())
	controller := &Controller{
		getter:      &postgresGetter{},
		setter:      &postgresSetter{queue: enqueueQueue},
		varResolver: &postgresVarResolver{getter: variableresolver.NewPostgresGetter(q)},
	}

	worker, err := reconcile.NewWorker(
		kind,
		queue,
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create deployment plan reconcile worker", "error", err)
	}

	return worker
}
