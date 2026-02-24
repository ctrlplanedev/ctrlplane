package deploymentresourceselectoreval

import (
	"context"
	"fmt"
	"runtime"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/postgres"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/deploymentresourceselectoreval")
var _ reconcile.Processor = (*Controller)(nil)

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource", "deployment").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

type Controller struct{}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) error {
	ctx, span := tracer.Start(ctx, "deploymentresourceselectoreval.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	queries := db.GetQueries(ctx)
	deploymentID, err := uuid.Parse(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("parse deployment id: %w", err)
	}

	deployment, err := queries.GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	deploymentSelector, err := celEnv.Compile(deployment.ResourceSelector.String)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("compile deployment selector: %w", err)
	}

	reosurces, err := queries.ListResourcesByWorkspaceID(ctx, deployment.WorkspaceID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	resourceMatchedIds := make([]uuid.UUID, 0)

	for _, resource := range reosurces {
		celCtx := map[string]any{
			"resource":   resource,
			"deployment": deployment,
		}
		matched, err := celutil.EvalBool(deploymentSelector, celCtx)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}
		if matched {
			resourceMatchedIds = append(resourceMatchedIds, resource.ID)
		}
	}

	return nil
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}
	log.Debug(
		"Creating deployment resourceselector eval worker",
		"maxConcurrency", runtime.GOMAXPROCS(0),
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   10 * time.Second,
		LeaseHeartbeat:  5 * time.Second,
		MaxConcurrency:  runtime.GOMAXPROCS(0),
		MaxRetryBackoff: 10 * time.Second,
	}

	kind := "deployment-resource-selector-eval"
	controller := &Controller{}
	worker, err := reconcile.NewWorker(
		kind,
		postgres.NewForKinds(pgxPool, kind),
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create deployment resourceselector eval worker", "error", err)
	}

	return worker
}
