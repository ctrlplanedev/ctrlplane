package eval

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/celutil"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("workspace-engine/pkg/workspace/relationships/eval")

var knownEntityTypes = []string{"resource", "deployment", "environment"}

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("from", "to").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

// CandidateLoader abstracts how candidate entities are loaded.
// Streaming-based and direct-query implementations can coexist.
type CandidateLoader interface {
	LoadCandidates(ctx context.Context, workspaceID uuid.UUID, entityType string) ([]EntityData, error)
}

// celMap returns the CEL evaluation map for an entity, ensuring "type" and
// "id" are always accessible even if the caller's Raw map omits them.
func celMap(e *EntityData) map[string]any {
	if e.Raw == nil {
		return map[string]any{
			"type": e.EntityType,
			"id":   e.ID.String(),
		}
	}
	if _, ok := e.Raw["type"]; !ok {
		e.Raw["type"] = e.EntityType
	}
	if _, ok := e.Raw["id"]; !ok {
		e.Raw["id"] = e.ID.String()
	}
	return e.Raw
}

// EvaluateRule evaluates a single rule for the given entity against a set of
// candidates. It handles directionality: the entity can be the "from" or "to"
// side depending on the rule's type guards.
//
// This is a pure computation — all data is supplied by the caller.
func EvaluateRule(
	ctx context.Context,
	entity *EntityData,
	rule *Rule,
	candidates []EntityData,
) ([]Match, error) {
	_, span := tracer.Start(ctx, "eval.EvaluateRule")
	defer span.End()
	span.SetAttributes(
		attribute.String("rule.id", rule.ID.String()),
		attribute.String("entity.type", entity.EntityType),
	)

	program, err := celEnv.Compile(rule.Cel)
	if err != nil {
		return nil, fmt.Errorf("compile rule CEL: %w", err)
	}

	celCtx := map[string]any{"from": nil, "to": nil}
	var matches []Match

	for _, candidate := range candidates {
		if candidate.ID == entity.ID {
			continue
		}

		celCtx["from"] = celMap(entity)
		celCtx["to"] = celMap(&candidate)
		ok, err := celutil.EvalBool(program, celCtx)
		if err != nil {
			return nil, fmt.Errorf("eval CEL for candidate %s: %w", candidate.ID, err)
		}
		if ok {
			matches = append(matches, Match{
				RuleID:         rule.ID,
				Reference:      rule.Reference,
				FromEntityType: entity.EntityType,
				FromEntityID:   entity.ID,
				ToEntityType:   candidate.EntityType,
				ToEntityID:     candidate.ID,
			})
		}

		celCtx["from"] = celMap(&candidate)
		celCtx["to"] = celMap(entity)
		ok, err = celutil.EvalBool(program, celCtx)
		if err != nil {
			return nil, fmt.Errorf("eval CEL for candidate %s: %w", candidate.ID, err)
		}
		if ok {
			matches = append(matches, Match{
				RuleID:         rule.ID,
				Reference:      rule.Reference,
				FromEntityType: candidate.EntityType,
				FromEntityID:   candidate.ID,
				ToEntityType:   entity.EntityType,
				ToEntityID:     entity.ID,
			})
		}
	}

	span.SetAttributes(attribute.Int("matches.count", len(matches)))
	return matches, nil
}

// EvaluateRules evaluates multiple rules for a given entity, loading
// candidates via the provided loader. Returns all matches across all rules.
func EvaluateRules(
	ctx context.Context,
	loader CandidateLoader,
	entity *EntityData,
	rules []Rule,
) ([]Match, error) {
	ctx, span := tracer.Start(ctx, "eval.EvaluateRules")
	defer span.End()

	var allCandidates []EntityData
	for _, entityType := range knownEntityTypes {
		candidates, err := loader.LoadCandidates(ctx, entity.WorkspaceID, entityType)
		if err != nil {
			return nil, fmt.Errorf("load candidates for entity %s (type %s): %w", entity.ID, entityType, err)
		}
		allCandidates = append(allCandidates, candidates...)
	}

	var allMatches []Match
	for _, rule := range rules {
		matches, err := EvaluateRule(ctx, entity, &rule, allCandidates)
		if err != nil {
			return nil, fmt.Errorf("evaluate rule %s: %w", rule.ID, err)
		}
		allMatches = append(allMatches, matches...)
	}

	span.SetAttributes(attribute.Int("matches.total", len(allMatches)))
	return allMatches, nil
}

// ResolveForReference finds all entities related to entity through rules
// matching the given reference name. Only rules whose Reference field
// matches are evaluated, keeping the candidate search targeted.
func ResolveForReference(
	ctx context.Context,
	loader CandidateLoader,
	entity *EntityData,
	rules []Rule,
	reference string,
) ([]Match, error) {
	ctx, span := tracer.Start(ctx, "eval.ResolveForReference")
	defer span.End()
	span.SetAttributes(
		attribute.String("reference", reference),
		attribute.String("entity.id", entity.ID.String()),
	)

	filtered := make([]Rule, 0, len(rules))
	for _, r := range rules {
		if r.Reference == reference {
			filtered = append(filtered, r)
		}
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	return EvaluateRules(ctx, loader, entity, filtered)
}
