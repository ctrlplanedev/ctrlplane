package relationgraph

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("workspace/relationships/relationgraph/builder")

// Builder constructs a relationship graph from entity stores and rules
type Builder struct {
	resources    map[string]*oapi.Resource
	deployments  map[string]*oapi.Deployment
	environments map[string]*oapi.Environment
	rules        map[string]*oapi.RelationshipRule
	options      BuildOptions
}

// BuildOptions configures the graph building process
type BuildOptions struct {
	// ParallelRules enables parallel processing of rules (future enhancement)
	ParallelRules bool
	// MaxConcurrency limits concurrent rule processing (future enhancement)
	MaxConcurrency int

	SetStatus func(msg string)
}

// DefaultBuildOptions returns sensible defaults
func DefaultBuildOptions() BuildOptions {
	return BuildOptions{
		ParallelRules:  false, // Keep simple for now
		MaxConcurrency: 10,
	}
}

// NewBuilder creates a new graph builder
func NewBuilder(
	resources map[string]*oapi.Resource,
	deployments map[string]*oapi.Deployment,
	environments map[string]*oapi.Environment,
	rules map[string]*oapi.RelationshipRule,
) *Builder {
	return &Builder{
		resources:    resources,
		deployments:  deployments,
		environments: environments,
		rules:        rules,
		options:      DefaultBuildOptions(),
	}
}

func (b *Builder) WithSetStatus(setStatus func(msg string)) *Builder {
	b.options.SetStatus = setStatus
	return b
}

// WithOptions sets custom build options
func (b *Builder) WithMaxConcurrency(maxConcurrency int) *Builder {
	b.options.MaxConcurrency = maxConcurrency
	return b
}

func (b *Builder) WithParallelRules(parallelRules bool) *Builder {
	b.options.ParallelRules = parallelRules
	return b
}

// Build constructs the complete relationship graph
// This is an expensive operation that should be done once and cached
func (b *Builder) Build(ctx context.Context) (*Graph, error) {
	ctx, span := tracer.Start(ctx, "relationgraph.Build")
	defer span.End()

	if b.options.SetStatus != nil {
		b.options.SetStatus("Building relationship graph...")
	}

	graph := NewGraph()

	// Get all entities once
	allEntities := b.getAllEntities()
	span.SetAttributes(
		attribute.Int("total_entities", len(allEntities)),
		attribute.Int("total_rules", len(b.rules)),
	)

	// Process each rule
	totalRules := len(b.rules)
	processedRules := 0
	for _, rule := range b.rules {
		if b.options.SetStatus != nil {
			percentage := int((float64(processedRules) / float64(totalRules)) * 100)
			b.options.SetStatus(fmt.Sprintf("Processing rules... %d%%", percentage))
		}

		if err := b.processRule(ctx, graph, rule, allEntities); err != nil {
			return nil, err
		}
		processedRules++
	}

	// Update graph metadata
	graph.entityCount = len(allEntities)
	graph.ruleCount = len(b.rules)

	span.SetAttributes(
		attribute.Int("total_relations", graph.relationCount),
	)

	if b.options.SetStatus != nil {
		b.options.SetStatus("Relationship graph built successfully")
	}

	return graph, nil
}

// processRule evaluates a single rule against all entities
func (b *Builder) processRule(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	allEntities []*oapi.RelatableEntity,
) error {
	ctx, span := tracer.Start(ctx, "relationgraph.processRule")
	defer span.End()

	span.SetAttributes(
		attribute.String("rule.reference", rule.Reference),
		attribute.String("rule.from_type", string(rule.FromType)),
		attribute.String("rule.to_type", string(rule.ToType)),
	)

	// Step 1: Filter entities that match the "from" selector
	fromEntities := b.filterEntities(ctx, allEntities, rule.FromType, rule.FromSelector)

	// Step 2: Filter entities that match the "to" selector
	toEntities := b.filterEntities(ctx, allEntities, rule.ToType, rule.ToSelector)

	span.SetAttributes(
		attribute.Int("from_entities", len(fromEntities)),
		attribute.Int("to_entities", len(toEntities)),
	)

	// Step 3: Evaluate matcher between all from/to pairs
	pairsEvaluated := 0
	matchesFound := 0

	for _, fromEntity := range fromEntities {
		for _, toEntity := range toEntities {
			pairsEvaluated++

			// Check if the matcher allows this relationship
			if relationships.Matches(ctx, &rule.Matcher, fromEntity, toEntity) {
				matchesFound++

				// Add forward relationship: from -> to
				graph.addRelation(fromEntity.GetID(), rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.To,
					EntityType: toEntity.GetType(),
					EntityId:   toEntity.GetID(),
					Entity:     *toEntity,
				})

				// Add reverse relationship: to -> from
				graph.addRelation(toEntity.GetID(), rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.From,
					EntityType: fromEntity.GetType(),
					EntityId:   fromEntity.GetID(),
					Entity:     *fromEntity,
				})
			}
		}
	}

	span.SetAttributes(
		attribute.Int("pairs_evaluated", pairsEvaluated),
		attribute.Int("matches_found", matchesFound),
	)

	return nil
}

// getAllEntities collects all entities from all stores
func (b *Builder) getAllEntities() []*oapi.RelatableEntity {
	totalSize := len(b.resources) + len(b.deployments) + len(b.environments)
	entities := make([]*oapi.RelatableEntity, 0, totalSize)

	for _, res := range b.resources {
		entities = append(entities, relationships.NewResourceEntity(res))
	}
	for _, dep := range b.deployments {
		entities = append(entities, relationships.NewDeploymentEntity(dep))
	}
	for _, env := range b.environments {
		entities = append(entities, relationships.NewEnvironmentEntity(env))
	}

	return entities
}

// filterEntities filters entities by type and selector
func (b *Builder) filterEntities(
	ctx context.Context,
	entities []*oapi.RelatableEntity,
	entityType oapi.RelatableEntityType,
	entitySelector *oapi.Selector,
) []*oapi.RelatableEntity {
	filtered := make([]*oapi.RelatableEntity, 0)

	for _, entity := range entities {
		if entity.GetType() != entityType {
			continue
		}

		// If no selector, match all entities of this type
		if entitySelector == nil {
			filtered = append(filtered, entity)
			continue
		}

		// Check selector match
		matched, _ := selector.Match(ctx, entitySelector, entity.Item())
		if matched {
			filtered = append(filtered, entity)
		}
	}

	return filtered
}
