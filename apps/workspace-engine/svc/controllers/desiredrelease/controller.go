package desiredrelease

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/pkg/workspace/releasemanager"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/svc/controllers/desiredrelease")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct{ releasemanager *releasemanager.Manager }

func parseReleaseTargetKey(key string) (deploymentId, environmentId, resourceId uuid.UUID, err error) {
	split := strings.SplitN(key, ":", 3)
	if len(split) != 3 {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("invalid release target key: %s", key)
	}
	deploymentId, err = uuid.Parse(split[0])
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("invalid deployment id: %s", split[0])
	}
	environmentId, err = uuid.Parse(split[1])
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("invalid environment id: %s", split[1])
	}
	resourceId, err = uuid.Parse(split[2])
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("invalid resource id: %s", split[2])
	}
	return deploymentId, environmentId, resourceId, nil
}

// Process implements [reconcile.Processor].
func (c *Controller) Process(ctx context.Context, item reconcile.Item) error {
	ctx, span := tracer.Start(ctx, "desiredrelease.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	rt, err := NewReleaseTarget(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("parse release target: %w", err)
	}

	rtoapi := oapi.ReleaseTarget{
		DeploymentId:  rt.DeploymentID.String(),
		EnvironmentId: rt.EnvironmentID.String(),
		ResourceId:    rt.ResourceID.String(),
	}

	desiredRelease, err := c.releasemanager.Planner().PlanDeployment(ctx, &rtoapi)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("plan deployment: %w", err)
	}
	if desiredRelease == nil {
		span.AddEvent("No desired release")
		span.SetAttributes(attribute.String("reconciliation_result", "no_desired_release"))
		return nil
	}

	return nil
}

func New(workerID string, pgxPool *pgxpool.Pool, releasemanager *releasemanager.Manager) svc.Service {
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

	kind := "desired-release"
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
