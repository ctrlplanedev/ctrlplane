package relationgraph

import (
	"context"
	"fmt"
	"sync/atomic"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/charmbracelet/log"
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
	// UseParallelProcessing enables parallel processing of entity pairs
	UseParallelProcessing bool
	// ChunkSize controls how many entity pairs to process per chunk
	ChunkSize int
	// MaxConcurrency limits concurrent chunk processing
	MaxConcurrency int

	SetStatus func(msg string)
}

// DefaultBuildOptions returns sensible defaults
func DefaultBuildOptions() BuildOptions {
	return BuildOptions{
		UseParallelProcessing: false, // Sequential by default for simplicity
		ChunkSize:             100,   // Process 100 entity pairs per chunk
		MaxConcurrency:        10,    // Max 10 concurrent goroutines
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

func (b *Builder) WithParallelProcessing(enabled bool) *Builder {
	b.options.UseParallelProcessing = enabled
	return b
}

func (b *Builder) WithChunkSize(chunkSize int) *Builder {
	b.options.ChunkSize = chunkSize
	return b
}

// Build constructs the complete relationship graph
// This is an expensive operation that should be done once and cached
func (b *Builder) Build(ctx context.Context) (*Graph, error) {
	ctx, span := tracer.Start(ctx, "relationgraph.Build")
	defer span.End()

	log.Info("Starting relationship graph build",
		"resources", len(b.resources),
		"deployments", len(b.deployments),
		"environments", len(b.environments),
		"rules", len(b.rules),
	)

	if b.options.SetStatus != nil {
		b.options.SetStatus("Building relationship graph...")
	}

	graph := NewGraph()

	// Get all entities once
	allEntities := b.getAllEntities()
	log.Info("Collected all entities", "total", len(allEntities))

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

		log.Info("Processing rule", "reference", rule.Reference, "from", rule.FromType, "to", rule.ToType)
		
		if err := b.processRule(ctx, graph, rule, allEntities); err != nil {
			log.Error("Failed to process rule", "reference", rule.Reference, "error", err)
			return nil, err
		}
		processedRules++
		log.Info("Completed rule", "reference", rule.Reference, "processed", processedRules, "total", len(b.rules))
	}

	// Update graph metadata
	graph.entityCount = len(allEntities)
	graph.ruleCount = len(b.rules)

	span.SetAttributes(
		attribute.Int("total_relations", graph.relationCount),
	)

	log.Info("Relationship graph built successfully",
		"total_relations", graph.relationCount,
		"entity_count", graph.entityCount,
		"rule_count", graph.ruleCount,
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
	log.Info("Filtered 'from' entities",
		"rule", rule.Reference,
		"type", rule.FromType,
		"count", len(fromEntities),
	)

	// Step 2: Filter entities that match the "to" selector
	toEntities := b.filterEntities(ctx, allEntities, rule.ToType, rule.ToSelector)
	log.Info("Filtered 'to' entities",
		"rule", rule.Reference,
		"type", rule.ToType,
		"count", len(toEntities),
	)

	span.SetAttributes(
		attribute.Int("from_entities", len(fromEntities)),
		attribute.Int("to_entities", len(toEntities)),
	)

	// Optimization #1: Early termination if no entities to match
	if len(fromEntities) == 0 || len(toEntities) == 0 {
		log.Info("Early termination - no entities to match",
			"rule", rule.Reference,
			"from_count", len(fromEntities),
			"to_count", len(toEntities),
		)
		span.SetAttributes(
			attribute.Int("pairs_evaluated", 0),
			attribute.Int("matches_found", 0),
			attribute.Bool("early_terminated", true),
		)
		return nil
	}

	// Step 3: Build entity map cache if using CEL matcher (for performance)
	var entityMapCache relationships.EntityMapCache
	if cm, err := rule.Matcher.AsCelMatcher(); err == nil && cm.Cel != "" {
		// Combine all entities that will be evaluated
		allRelevantEntities := make([]*oapi.RelatableEntity, 0, len(fromEntities)+len(toEntities))
		allRelevantEntities = append(allRelevantEntities, fromEntities...)
		if rule.FromType != rule.ToType {
			allRelevantEntities = append(allRelevantEntities, toEntities...)
		}
		
		log.Info("Building entity map cache for CEL matcher",
			"rule", rule.Reference,
			"entities", len(allRelevantEntities),
		)
		entityMapCache = relationships.BuildEntityMapCache(allRelevantEntities)
	}

	// Step 4: Evaluate matcher between all from/to pairs
	var pairsEvaluated, matchesFound int

	// Use optimized same-type processing if applicable
	// Only optimize if from and to selectors produce the same entity set
	if rule.FromType == rule.ToType && len(fromEntities) == len(toEntities) {
		// Check if fromEntities and toEntities are the same set
		isSameSet := true
		entitySet := make(map[string]bool, len(fromEntities))
		for _, e := range fromEntities {
			entitySet[e.GetID()] = true
		}
		for _, e := range toEntities {
			if !entitySet[e.GetID()] {
				isSameSet = false
				break
			}
		}
		
		if isSameSet {
			pairsEvaluated, matchesFound = b.processSameTypeRelationships(ctx, graph, rule, fromEntities, entityMapCache)
		} else {
			// Different selectors produce different sets, treat as different-type
			pairsEvaluated, matchesFound = b.processDifferentTypeRelationships(ctx, graph, rule, fromEntities, toEntities, entityMapCache)
		}
	} else {
		pairsEvaluated, matchesFound = b.processDifferentTypeRelationships(ctx, graph, rule, fromEntities, toEntities, entityMapCache)
	}

	span.SetAttributes(
		attribute.Int("pairs_evaluated", pairsEvaluated),
		attribute.Int("matches_found", matchesFound),
		attribute.Bool("used_parallel_processing", b.options.UseParallelProcessing && len(fromEntities) > b.options.ChunkSize),
	)

	log.Info("Rule processing completed",
		"rule", rule.Reference,
		"pairs_evaluated", pairsEvaluated,
		"matches_found", matchesFound,
		"match_rate", fmt.Sprintf("%.2f%%", float64(matchesFound)/float64(max(pairsEvaluated, 1))*100),
	)

	return nil
}

// processSameTypeRelationships handles relationships where fromType == toType
// Uses optimized upper-triangle processing to avoid evaluating each pair twice
func (b *Builder) processSameTypeRelationships(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	entities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) (pairsEvaluated int, matchesFound int) {
	// Upper triangle: n*(n-1)/2
	estimatedPairs := (len(entities) * (len(entities) - 1)) / 2
	
	log.Info("Evaluating same-type entity pairs (optimized)",
		"rule", rule.Reference,
		"entities", len(entities),
		"estimated_pairs", estimatedPairs,
		"parallel", b.options.UseParallelProcessing,
	)

	if b.options.UseParallelProcessing && len(entities) > b.options.ChunkSize {
		return b.processSameTypeParallel(ctx, graph, rule, entities, entityMapCache)
	}
	return b.processSameTypeSequential(ctx, graph, rule, entities, entityMapCache)
}

// processSameTypeSequential processes same-type relationships sequentially
func (b *Builder) processSameTypeSequential(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	entities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) (pairsEvaluated int, matchesFound int) {
	log.Info("Using sequential processing (same-type optimized)", "rule", rule.Reference)

	// Process upper triangle only
	for fromIdx, fromEntity := range entities {
		fromID := fromEntity.GetID()

		// Start from fromIdx + 1 to skip self and already-evaluated pairs
		for toIdx := fromIdx + 1; toIdx < len(entities); toIdx++ {
			toEntity := entities[toIdx]
			toID := toEntity.GetID()
			pairsEvaluated++

			// Check both directions for same-type relationships
			// since matchers might be asymmetric
			forwardMatch := relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, toEntity, entityMapCache)
			reverseMatch := relationships.MatchesWithCache(ctx, &rule.Matcher, toEntity, fromEntity, entityMapCache)

			if forwardMatch {
				matchesFound++
				// Add forward relationship: from -> to
				graph.addRelation(fromID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.To,
					EntityType: toEntity.GetType(),
					EntityId:   toID,
					Entity:     *toEntity,
				})
				// Add reverse perspective: to -> from
				graph.addRelation(toID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.From,
					EntityType: fromEntity.GetType(),
					EntityId:   fromID,
					Entity:     *fromEntity,
				})
			}

			if reverseMatch {
				matchesFound++
				// Add reverse relationship: to -> from (as forward)
				graph.addRelation(toID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.To,
					EntityType: fromEntity.GetType(),
					EntityId:   fromID,
					Entity:     *fromEntity,
				})
				// Add reverse perspective: from -> to (as from)
				graph.addRelation(fromID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.From,
					EntityType: toEntity.GetType(),
					EntityId:   toID,
					Entity:     *toEntity,
				})
			}
		}
	}

	log.Info("Sequential processing completed",
		"rule", rule.Reference,
		"matches_found", matchesFound,
		"pairs_evaluated", pairsEvaluated,
	)

	return pairsEvaluated, matchesFound
}

// processSameTypeParallel processes same-type relationships in parallel
func (b *Builder) processSameTypeParallel(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	entities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) (pairsEvaluated int, matchesFound int) {
	log.Info("Using parallel processing (same-type optimized)",
		"rule", rule.Reference,
		"entities", len(entities),
		"chunk_size", b.options.ChunkSize,
		"max_concurrency", b.options.MaxConcurrency,
	)

	type entityPairResult struct {
		fromID     string
		toID       string
		fromEntity *oapi.RelatableEntity
		toEntity   *oapi.RelatableEntity
	}

	type indexedEntity struct {
		entity *oapi.RelatableEntity
		index  int
	}

	indexedEntities := make([]indexedEntity, len(entities))
	for i, entity := range entities {
		indexedEntities[i] = indexedEntity{entity: entity, index: i}
	}

	var processedEntities atomic.Int64
	totalEntities := len(entities)

	results, err := concurrency.ProcessInChunks(
		indexedEntities,
		b.options.ChunkSize,
		b.options.MaxConcurrency,
		func(indexedFrom indexedEntity) ([]entityPairResult, error) {
			fromEntity := indexedFrom.entity
			fromIdx := indexedFrom.index

			estimatedMatches := max(len(entities)/10, 1)
			matches := make([]entityPairResult, 0, estimatedMatches)
			fromID := fromEntity.GetID()

			// Process upper triangle: start from fromIdx + 1
			// Check both directions since matchers might be asymmetric
			for toIdx := fromIdx + 1; toIdx < len(entities); toIdx++ {
				toEntity := entities[toIdx]
				toID := toEntity.GetID()

				forwardMatch := relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, toEntity, entityMapCache)
				reverseMatch := relationships.MatchesWithCache(ctx, &rule.Matcher, toEntity, fromEntity, entityMapCache)

				if forwardMatch {
					matches = append(matches, entityPairResult{
						fromID:     fromID,
						toID:       toID,
						fromEntity: fromEntity,
						toEntity:   toEntity,
					})
				}
				
				if reverseMatch {
					// Swap from/to for reverse direction
					matches = append(matches, entityPairResult{
						fromID:     toID,
						toID:       fromID,
						fromEntity: toEntity,
						toEntity:   fromEntity,
					})
				}
			}

			// Log progress every 500 entities
			entityNum := processedEntities.Add(1)
			if entityNum%500 == 0 || entityNum == int64(totalEntities) {
				percentage := (entityNum * 100) / int64(totalEntities)
				log.Info("Parallel processing progress",
					"rule", rule.Reference,
					"processed_entities", entityNum,
					"total_entities", totalEntities,
					"progress", fmt.Sprintf("%d%%", percentage),
				)
			}

			return matches, nil
		},
	)

	if err != nil {
		log.Error("Parallel processing failed", "rule", rule.Reference, "error", err)
		return 0, 0
	}

	// Flatten results and add to graph
	for _, chunkResults := range results {
		for _, match := range chunkResults {
			// Add forward relationship: from -> to
			graph.addRelation(match.fromID, rule.Reference, &oapi.EntityRelation{
				Rule:       rule,
				Direction:  oapi.To,
				EntityType: match.toEntity.GetType(),
				EntityId:   match.toID,
				Entity:     *match.toEntity,
			})
			
			// Add reverse perspective: to -> from
			graph.addRelation(match.toID, rule.Reference, &oapi.EntityRelation{
				Rule:       rule,
				Direction:  oapi.From,
				EntityType: match.fromEntity.GetType(),
				EntityId:   match.fromID,
				Entity:     *match.fromEntity,
			})

			matchesFound++
		}
	}

	// Upper triangle: n*(n-1)/2
	pairsEvaluated = (len(entities) * (len(entities) - 1)) / 2

	log.Info("Parallel processing completed",
		"rule", rule.Reference,
		"matches_found", matchesFound,
		"pairs_evaluated", pairsEvaluated,
	)

	return pairsEvaluated, matchesFound
}

// processDifferentTypeRelationships handles relationships where fromType != toType
func (b *Builder) processDifferentTypeRelationships(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	fromEntities []*oapi.RelatableEntity,
	toEntities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) (pairsEvaluated int, matchesFound int) {
	estimatedPairs := len(fromEntities) * len(toEntities)
	
	log.Info("Evaluating different-type entity pairs",
		"rule", rule.Reference,
		"from_entities", len(fromEntities),
		"to_entities", len(toEntities),
		"estimated_pairs", estimatedPairs,
		"parallel", b.options.UseParallelProcessing,
	)

	if b.options.UseParallelProcessing && len(fromEntities) > b.options.ChunkSize {
		return b.processDifferentTypeParallel(ctx, graph, rule, fromEntities, toEntities, entityMapCache)
	}
	return b.processDifferentTypeSequential(ctx, graph, rule, fromEntities, toEntities, entityMapCache)
}

// processDifferentTypeSequential processes different-type relationships sequentially
func (b *Builder) processDifferentTypeSequential(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	fromEntities []*oapi.RelatableEntity,
	toEntities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) (pairsEvaluated int, matchesFound int) {
	log.Info("Using sequential processing (different-type)", "rule", rule.Reference)

	for _, fromEntity := range fromEntities {
		fromID := fromEntity.GetID()

		for _, toEntity := range toEntities {
			toID := toEntity.GetID()
			pairsEvaluated++

			if relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, toEntity, entityMapCache) {
				matchesFound++

				// Add forward relationship: from -> to
				graph.addRelation(fromID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.To,
					EntityType: toEntity.GetType(),
					EntityId:   toID,
					Entity:     *toEntity,
				})

				// Add reverse relationship: to -> from
				graph.addRelation(toID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.From,
					EntityType: fromEntity.GetType(),
					EntityId:   fromID,
					Entity:     *fromEntity,
				})
			}
		}
	}

	log.Info("Sequential processing completed",
		"rule", rule.Reference,
		"matches_found", matchesFound,
		"pairs_evaluated", pairsEvaluated,
	)

	return pairsEvaluated, matchesFound
}

// processDifferentTypeParallel processes different-type relationships in parallel
func (b *Builder) processDifferentTypeParallel(
	ctx context.Context,
	graph *Graph,
	rule *oapi.RelationshipRule,
	fromEntities []*oapi.RelatableEntity,
	toEntities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) (pairsEvaluated int, matchesFound int) {
	log.Info("Using parallel processing (different-type)",
		"rule", rule.Reference,
		"from_entities", len(fromEntities),
		"to_entities", len(toEntities),
		"chunk_size", b.options.ChunkSize,
		"max_concurrency", b.options.MaxConcurrency,
	)

	type entityPairResult struct {
		fromID     string
		toID       string
		fromEntity *oapi.RelatableEntity
		toEntity   *oapi.RelatableEntity
	}

	var processedEntities atomic.Int64
	totalEntities := len(fromEntities)

	results, err := concurrency.ProcessInChunks(
		fromEntities,
		b.options.ChunkSize,
		b.options.MaxConcurrency,
		func(fromEntity *oapi.RelatableEntity) ([]entityPairResult, error) {
			estimatedMatches := max(len(toEntities)/10, 1)
			matches := make([]entityPairResult, 0, estimatedMatches)
			fromID := fromEntity.GetID()

			for _, toEntity := range toEntities {
				toID := toEntity.GetID()

				if relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, toEntity, entityMapCache) {
					matches = append(matches, entityPairResult{
						fromID:     fromID,
						toID:       toID,
						fromEntity: fromEntity,
						toEntity:   toEntity,
					})
				}
			}

			// Log progress every 500 entities
			entityNum := processedEntities.Add(1)
			if entityNum%500 == 0 || entityNum == int64(totalEntities) {
				percentage := (entityNum * 100) / int64(totalEntities)
				log.Info("Parallel processing progress",
					"rule", rule.Reference,
					"processed_entities", entityNum,
					"total_entities", totalEntities,
					"progress", fmt.Sprintf("%d%%", percentage),
				)
			}

			return matches, nil
		},
	)

	if err != nil {
		log.Error("Parallel processing failed", "rule", rule.Reference, "error", err)
		return 0, 0
	}

	// Flatten results and add to graph
	for _, chunkResults := range results {
		for _, match := range chunkResults {
			// Add forward relationship: from -> to
			graph.addRelation(match.fromID, rule.Reference, &oapi.EntityRelation{
				Rule:       rule,
				Direction:  oapi.To,
				EntityType: match.toEntity.GetType(),
				EntityId:   match.toID,
				Entity:     *match.toEntity,
			})

			// Add reverse relationship: to -> from
			graph.addRelation(match.toID, rule.Reference, &oapi.EntityRelation{
				Rule:       rule,
				Direction:  oapi.From,
				EntityType: match.fromEntity.GetType(),
				EntityId:   match.fromID,
				Entity:     *match.fromEntity,
			})

			matchesFound++
		}
	}

	pairsEvaluated = len(fromEntities) * len(toEntities)

	log.Info("Parallel processing completed",
		"rule", rule.Reference,
		"matches_found", matchesFound,
		"pairs_evaluated", pairsEvaluated,
	)

	return pairsEvaluated, matchesFound
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
