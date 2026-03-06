package relationshipeval

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"

	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"
	"workspace-engine/pkg/workspace/relationships/eval"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

// FormatScopeID encodes an entity type and ID into the scope ID format "type:uuid".
func FormatScopeID(entityType string, entityID string) string {
	return entityType + ":" + entityID
}

// ParseScopeID decodes a "type:uuid" scope ID into its parts.
func ParseScopeID(scopeID string) (entityType string, entityID uuid.UUID, err error) {
	parts := strings.SplitN(scopeID, ":", 2)
	if len(parts) != 2 {
		return "", uuid.Nil, fmt.Errorf("invalid scope id format, expected type:uuid, got %q", scopeID)
	}
	entityType = parts[0]
	entityID, err = uuid.Parse(parts[1])
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("parse uuid from scope id %q: %w", scopeID, err)
	}
	return entityType, entityID, nil
}

var tracer = otel.Tracer("workspace-engine/svc/controllers/relationshipeval")
var _ reconcile.Processor = (*Controller)(nil)

type Controller struct {
	getter Getter
	setter Setter
}

func (c *Controller) Process(ctx context.Context, item reconcile.Item) (reconcile.Result, error) {
	ctx, span := tracer.Start(ctx, "relationshipeval.Controller.Process")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("item.id", item.ID),
		attribute.String("item.kind", item.Kind),
		attribute.String("item.scope_type", item.ScopeType),
		attribute.String("item.scope_id", item.ScopeID),
	)

	entityType, entityID, err := ParseScopeID(item.ScopeID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return reconcile.Result{}, fmt.Errorf("parse scope id: %w", err)
	}

	entity, err := c.getter.GetEntityInfo(ctx, entityType, entityID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get entity info: %w", err)
	}

	rules, err := c.getter.GetRulesForWorkspace(ctx, entity.WorkspaceID)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("get rules: %w", err)
	}

	span.SetAttributes(
		attribute.String("entity.type", entity.EntityType),
		attribute.Int("rules.total", len(rules)),
	)

	evalEntity := toEvalEntity(entity)
	evalRules := toEvalRules(rules)

	loader := &streamingCandidateLoader{getter: c.getter}
	matches, err := eval.EvaluateRules(ctx, loader, evalEntity, evalRules)
	if err != nil {
		return reconcile.Result{}, fmt.Errorf("evaluate rules: %w", err)
	}

	allRelationships := make([]ComputedRelationship, len(matches))
	for i, m := range matches {
		allRelationships[i] = ComputedRelationship{
			RuleID:         m.RuleID,
			FromEntityType: m.FromEntityType,
			FromEntityID:   m.FromEntityID,
			ToEntityType:   m.ToEntityType,
			ToEntityID:     m.ToEntityID,
		}
	}

	span.SetAttributes(attribute.Int("relationships.computed", len(allRelationships)))

	if err := c.setter.SetComputedRelationships(ctx, entity.EntityType, entityID, allRelationships); err != nil {
		return reconcile.Result{}, fmt.Errorf("set computed relationships: %w", err)
	}

	return reconcile.Result{}, nil
}

// streamingCandidateLoader implements eval.CandidateLoader by loading all
// candidates of the requested type for the workspace into memory. The
// background batch controller can afford this since it processes one entity
// at a time with generous timeouts.
type streamingCandidateLoader struct {
	getter Getter
}

func (l *streamingCandidateLoader) LoadCandidates(ctx context.Context, workspaceID uuid.UUID, entityType string) ([]eval.EntityData, error) {
	batches := make(chan []EntityInfo, runtime.GOMAXPROCS(0))
	errCh := make(chan error, 1)

	go func() {
		errCh <- l.getter.StreamCandidateEntities(ctx, workspaceID, entityType, 5000, batches)
	}()

	var candidates []eval.EntityData
	for batch := range batches {
		for _, e := range batch {
			candidates = append(candidates, eval.EntityData{
				ID:          e.ID,
				WorkspaceID: e.WorkspaceID,
				EntityType:  e.EntityType,
				Raw:         e.Raw,
			})
		}
	}

	if err := <-errCh; err != nil {
		return nil, err
	}
	return candidates, nil
}

func toEvalEntity(e *EntityInfo) *eval.EntityData {
	return &eval.EntityData{
		ID:          e.ID,
		WorkspaceID: e.WorkspaceID,
		EntityType:  e.EntityType,
		Raw:         e.Raw,
	}
}

func toEvalRules(rules []RuleInfo) []eval.Rule {
	out := make([]eval.Rule, len(rules))
	for i, r := range rules {
		out[i] = eval.Rule{
			ID:        r.ID,
			Reference: r.Reference,
			Cel:       r.Cel,
		}
	}
	return out
}

// NewController creates a Controller with the given dependencies.
func NewController(getter Getter, setter Setter) *Controller {
	return &Controller{getter: getter, setter: setter}
}

func New(workerID string, pgxPool *pgxpool.Pool) svc.Service {
	if pgxPool == nil {
		log.Fatal("Failed to get pgx pool")
		panic("failed to get pgx pool")
	}
	log.Debug(
		"Creating relationship eval worker",
		"maxConcurrency", runtime.GOMAXPROCS(0),
	)

	nodeConfig := reconcile.NodeConfig{
		WorkerID:        workerID,
		BatchSize:       10,
		PollInterval:    1 * time.Second,
		LeaseDuration:   30 * time.Second,
		LeaseHeartbeat:  10 * time.Second,
		MaxConcurrency:  runtime.GOMAXPROCS(0),
		MaxRetryBackoff: 10 * time.Second,
	}

	kind := events.RelationshipEvalKind
	controller := &Controller{
		getter: &PostgresGetter{},
		setter: &PostgresSetter{},
	}
	worker, err := reconcile.NewWorker(
		kind,
		postgres.NewForKinds(pgxPool, kind),
		controller,
		nodeConfig,
	)
	if err != nil {
		log.Fatal("Failed to create relationship eval worker", "error", err)
	}

	return worker
}
