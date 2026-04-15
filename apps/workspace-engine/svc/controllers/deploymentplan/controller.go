package deploymentplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/pkg/selector"
	"workspace-engine/svc"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/deploymentplan")

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

	if deployment.JobAgentSelector == "" {
		if err := c.setter.CompletePlan(ctx, planID); err != nil {
			return reconcile.Result{}, fmt.Errorf("mark plan completed: %w", err)
		}
		return reconcile.Result{}, nil
	}

	allAgents, err := c.getter.ListJobAgentsByWorkspaceID(ctx, plan.WorkspaceID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("list job agents: %w", err)
	}

	if len(allAgents) == 0 {
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
		if err := c.processTarget(
			ctx,
			plan,
			deployment,
			allAgents,
			version,
			target,
		); err != nil {
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
	agents []oapi.JobAgent,
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

	matchedAgents, err := selector.MatchJobAgentsWithResource(
		ctx,
		deployment.JobAgentSelector,
		agents,
		resource,
	)
	if err != nil {
		return fmt.Errorf("match job agents for resource %s: %w", target.ResourceID, err)
	}

	if len(matchedAgents) == 0 {
		return nil
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

	release := &oapi.Release{
		CreatedAt: plan.CreatedAt.Time.Format(time.RFC3339),
		Id:        uuid.New(),
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  plan.DeploymentID.String(),
			EnvironmentId: target.EnvironmentID.String(),
			ResourceId:    target.ResourceID.String(),
		},
		Variables:          variables,
		Version:            *version,
		EncryptedVariables: []string{},
	}

	for i := range matchedAgents {
		agent := &matchedAgents[i]

		mergedConfig := oapi.DeepMergeConfigs(
			agent.Config, deployment.JobAgentConfig, version.JobAgentConfig,
		)

		dispatchCtx := &oapi.DispatchContext{
			Deployment:     deployment,
			Environment:    env,
			Resource:       resource,
			Version:        version,
			Release:        release,
			Variables:      &variables,
			JobAgent:       *agent,
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

		if err := c.setter.EnqueueResult(
			ctx,
			plan.WorkspaceID.String(),
			resultID.String(),
		); err != nil {
			return fmt.Errorf("enqueue plan target result: %w", err)
		}
	}

	return nil
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}

	kind := events.DeploymentPlanKind
	maxConcurrency := config.GetMaxConcurrency(kind)
	log.Debug(
		"Creating deployment plan reconcile worker",
		"maxConcurrency", maxConcurrency,
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   30 * time.Second,
		LeaseHeartbeat:  15 * time.Second,
		MaxConcurrency:  maxConcurrency,
		MaxRetryBackoff: 10 * time.Second,
	}
	queue := postgres.NewForKinds(pgxPool, kind)
	enqueueQueue := postgres.New(pgxPool)

	q := db.GetQueries(context.Background())
	controller := &Controller{
		getter:      &PostgresGetter{},
		setter:      &PostgresSetter{queue: enqueueQueue},
		varResolver: NewPostgresVarResolver(variableresolver.NewPostgresGetter(q)),
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
