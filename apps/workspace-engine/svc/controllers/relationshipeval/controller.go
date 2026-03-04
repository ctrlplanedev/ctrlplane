package relationshipeval

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"
	"workspace-engine/svc"

	"github.com/charmbracelet/log"
	"github.com/google/cel-go/cel"

	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/reconcile/postgres"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/sync/errgroup"
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

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("from", "to").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

const streamBatchSize = 5000

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

	var allRelationships []ComputedRelationship
	for _, rule := range rules {
		rels, err := c.evalRule(ctx, entity, &rule)
		if err != nil {
			return reconcile.Result{}, fmt.Errorf("eval rule %s: %w", rule.ID, err)
		}
		allRelationships = append(allRelationships, rels...)
	}

	span.SetAttributes(attribute.Int("relationships.computed", len(allRelationships)))

	if err := c.setter.SetComputedRelationships(ctx, entity.EntityType, entityID, allRelationships); err != nil {
		return reconcile.Result{}, fmt.Errorf("set computed relationships: %w", err)
	}

	return reconcile.Result{}, nil
}

// evalRule evaluates a single relationship rule for the given entity.
// It checks if the entity participates as "from" or "to" (or both) in the rule,
// streams candidate entities of the opposite type, and evaluates the CEL expression.
func (c *Controller) evalRule(ctx context.Context, entity *EntityInfo, rule *RuleInfo) ([]ComputedRelationship, error) {
	ctx, span := tracer.Start(ctx, "EvalRule")
	defer span.End()
	span.SetAttributes(
		attribute.String("rule.id", rule.ID.String()),
		attribute.String("rule.from_type", rule.FromType),
		attribute.String("rule.to_type", rule.ToType),
	)

	program, err := celEnv.Compile(rule.Cel)
	if err != nil {
		return nil, fmt.Errorf("compile rule CEL: %w", err)
	}

	var relationships []ComputedRelationship

	// Entity is "from" → stream "to" candidates
	if entity.EntityType == rule.FromType {
		matches, err := c.evalCandidates(ctx, entity, rule.ToType, program, true)
		if err != nil {
			return nil, err
		}
		for _, candidateID := range matches {
			relationships = append(relationships, ComputedRelationship{
				RuleID:         rule.ID,
				FromEntityType: entity.EntityType,
				FromEntityID:   entity.ID,
				ToEntityType:   rule.ToType,
				ToEntityID:     candidateID,
			})
		}
	}

	// Entity is "to" → stream "from" candidates
	if entity.EntityType == rule.ToType {
		matches, err := c.evalCandidates(ctx, entity, rule.FromType, program, false)
		if err != nil {
			return nil, err
		}
		for _, candidateID := range matches {
			relationships = append(relationships, ComputedRelationship{
				RuleID:         rule.ID,
				FromEntityType: rule.FromType,
				FromEntityID:   candidateID,
				ToEntityType:   entity.EntityType,
				ToEntityID:     entity.ID,
			})
		}
	}

	span.SetAttributes(attribute.Int("relationships.count", len(relationships)))
	return relationships, nil
}

// evalCandidates streams candidates of candidateType and evaluates the CEL program.
// When entityIsFrom is true, the entity is placed in "from" and candidates in "to";
// otherwise the positions are reversed. It attempts to push extractable predicates
// from the CEL expression into SQL to pre-filter candidates.
func (c *Controller) evalCandidates(
	ctx context.Context,
	entity *EntityInfo,
	candidateType string,
	program cel.Program,
	entityIsFrom bool,
) ([]uuid.UUID, error) {
	numWorkers := runtime.GOMAXPROCS(0)
	batches := make(chan []EntityInfo, numWorkers)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		return c.getter.StreamCandidateEntities(ctx, entity.WorkspaceID, candidateType, streamBatchSize, batches)
	})

	var mu sync.Mutex
	var matchedIDs []uuid.UUID
	for range numWorkers {
		g.Go(func() error {
			celCtx := map[string]any{
				"from": nil,
				"to":   nil,
			}
			var local []uuid.UUID
			for batch := range batches {
				for _, candidate := range batch {
					if candidate.ID == entity.ID {
						continue
					}

					if entityIsFrom {
						celCtx["from"] = entity.Raw
						celCtx["to"] = candidate.Raw
					} else {
						celCtx["from"] = candidate.Raw
						celCtx["to"] = entity.Raw
					}

					ok, err := celutil.EvalBool(program, celCtx)
					if err != nil {
						return fmt.Errorf("eval CEL for candidate %s: %w", candidate.ID, err)
					}
					if ok {
						local = append(local, candidate.ID)
					}
				}
			}
			if len(local) > 0 {
				mu.Lock()
				matchedIDs = append(matchedIDs, local...)
				mu.Unlock()
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return matchedIDs, nil
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
