package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/relationships/relationgraph"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel"
	"golang.org/x/sync/errgroup"
)

var relationshipsTracer = otel.Tracer("workspace.store.relationships")

func NewRelationshipRules(store *Store) *RelationshipRules {
	return &RelationshipRules{
		repo:  store.repo,
		store: store,
	}
}

type RelationshipRules struct {
	repo  *repository.InMemoryStore
	store *Store

	graph *relationgraph.Graph
}

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, relationship)
	}

	r.store.changeset.RecordUpsert(relationship)

	if err := r.buildGraph(ctx, nil); err != nil {
		return err
	}

	return nil
}

func (r *RelationshipRules) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Has(id string) bool {
	return r.repo.RelationshipRules.Has(id)
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) error {
	relationship, ok := r.repo.RelationshipRules.Get(id)
	if !ok || relationship == nil {
		return nil
	}

	r.repo.RelationshipRules.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, relationship)
	}

	r.store.changeset.RecordDelete(relationship)

	return r.buildGraph(ctx, nil)
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

// GetRelatedEntities returns all entities related to the given entity, grouped by relationship reference.
// This includes relationships where the entity is the "from" side (outgoing) or "to" side (incoming).
// func (r *RelationshipRules) GetRelatedEntities(
// 	ctx context.Context,
// 	entity *oapi.RelatableEntity,
// ) (
// 	map[string][]*oapi.EntityRelation,
// 	error,
// ) {
// 	if r.graph == nil {
// 		if err := r.buildGraph(ctx, nil); err != nil {
// 			return nil, err
// 		}
// 	}

// 	return r.graph.GetRelatedEntities(entity.GetID()), nil
// }

func (r *RelationshipRules) InvalidateGraph(ctx context.Context) error {
	r.graph = nil
	return r.buildGraph(ctx, nil)
}

func (r *RelationshipRules) buildGraph(ctx context.Context, setStatus func(msg string)) (err error) {
	builder := relationgraph.NewBuilder(
		r.store.Resources.Items(),
		r.store.Deployments.Items(),
		r.store.Environments.Items(),
		r.repo.RelationshipRules.Items(),
	).WithParallelProcessing(true).
		WithChunkSize(50).     // Smaller chunks to show progress more frequently
		WithMaxConcurrency(16) // Use more goroutines for heavy workloads

	if setStatus != nil {
		builder = builder.WithSetStatus(setStatus)
	}

	r.graph, err = builder.Build(ctx)
	return err
}

// legacy
// matchesSelector checks if an entity matches the given type and selector
func (r *RelationshipRules) matchesSelector(
	ctx context.Context,
	targetType oapi.RelatableEntityType,
	targetSelector *oapi.Selector,
	entity *oapi.RelatableEntity,
) (bool, error) {
	if targetType != entity.GetType() {
		return false, nil
	}
	if targetSelector == nil {
		return true, nil
	}
	return selector.Match(ctx, targetSelector, entity.Item())
}

func (r *RelationshipRules) collectFromRules(
	ctx context.Context,
	allRules map[string]*oapi.RelationshipRule,
	entity *oapi.RelatableEntity,
) ([]*oapi.RelationshipRule, error) {
	entityType := entity.GetType()
	var rules []*oapi.RelationshipRule
	for _, rule := range allRules {
		if rule.FromType != entityType {
			continue
		}
		if rule.FromSelector == nil {
			continue
		}
		matched, err := r.matchesSelector(ctx, rule.FromType, rule.FromSelector, entity)
		if err != nil {
			return nil, err
		}
		if !matched {
			continue
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *RelationshipRules) collectToRules(
	ctx context.Context,
	allRules map[string]*oapi.RelationshipRule,
	entity *oapi.RelatableEntity,
) ([]*oapi.RelationshipRule, error) {
	entityType := entity.GetType()
	var rules []*oapi.RelationshipRule
	for _, rule := range allRules {
		if rule.ToType != entityType {
			continue
		}
		if rule.ToSelector == nil {
			continue
		}
		matched, err := r.matchesSelector(ctx, rule.ToType, rule.ToSelector, entity)
		if err != nil {
			return nil, err
		}
		if !matched {
			continue
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *RelationshipRules) GetRelatedEntities(
	ctx context.Context,
	entity *oapi.RelatableEntity,
) (
	map[string][]*oapi.EntityRelation,
	error,
) {
	ctx, span := relationshipsTracer.Start(ctx, "GetRelatedEntities")
	defer span.End()

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	result := make(map[string][]*oapi.EntityRelation)

	allRules := r.repo.RelationshipRules.Items()
	fromRules, err := r.collectFromRules(ctx, allRules, entity)
	if err != nil {
		return nil, err
	}
	toRules, err := r.collectToRules(ctx, allRules, entity)
	if err != nil {
		return nil, err
	}

	allResources := r.store.Resources.Items()
	resourceSlice := make([]*oapi.Resource, 0, len(allResources))
	for _, resource := range allResources {
		resourceSlice = append(resourceSlice, resource)
	}

	for _, rule := range fromRules {
		if rule.ToType != oapi.RelatableEntityTypeResource {
			continue
		}

		toEntities, err := r.findMatchingResourcesBasic(ctx, rule, rule.ToSelector, entity, true, resourceSlice)
		if err != nil {
			return nil, err
		}
		if len(toEntities) == 0 {
			continue
		}
		for _, toEntity := range toEntities {
			result[rule.Reference] = append(result[rule.Reference], &oapi.EntityRelation{
				Rule:       rule,
				Direction:  oapi.To,
				EntityType: toEntity.GetType(),
				EntityId:   toEntity.GetID(),
				Entity:     *toEntity,
			})
		}
	}

	for _, rule := range toRules {
		if rule.FromType != oapi.RelatableEntityTypeResource {
			continue
		}

		fromEntities, err := r.findMatchingResourcesBasic(ctx, rule, rule.FromSelector, entity, false, resourceSlice)
		if err != nil {
			return nil, err
		}
		if len(fromEntities) == 0 {
			continue
		}
		for _, fromEntity := range fromEntities {
			result[rule.Reference] = append(result[rule.Reference], &oapi.EntityRelation{
				Rule:       rule,
				Direction:  oapi.From,
				EntityType: fromEntity.GetType(),
				EntityId:   fromEntity.GetID(),
				Entity:     *fromEntity,
			})
		}
	}

	return result, nil
}

// for _, rule := range rules {
// 	if rule.FromType == entityType && r.matchesSelector(ctx, )
// }

// // Find all relationship rules where this entity matches
// for _, rule := range r.repo.RelationshipRules.Items() {
// 	// Early exit: skip rules that don't involve this entity type
// 	if rule.FromType != entityType && rule.ToType != entityType {
// 		continue
// 	}

// 	// Check if this entity matches the "from" selector
// 	fromMatches, _ := r.matchesSelector(ctx, rule.FromType, rule.FromSelector, entity)
// 	// If entity is on the "from" side, find matching "to" entities
// 	if fromMatches {
// 		g.Go(func() error {
// 			toEntities, err := r.findMatchingEntities(ctx, rule, rule.ToType, rule.ToSelector, entity, true)
// 			if err != nil {
// 				return err
// 			}
// 			if len(toEntities) > 0 {
// 				relatedEntities := make([]*oapi.EntityRelation, 0, len(toEntities))
// 				for _, toEntity := range toEntities {
// 					relatedEntities = append(relatedEntities, &oapi.EntityRelation{
// 						Rule:       rule,
// 						Direction:  oapi.To,
// 						EntityType: toEntity.GetType(),
// 						EntityId:   toEntity.GetID(),
// 						Entity:     *toEntity,
// 					})
// 				}

// 				mu.Lock()
// 				result[rule.Reference] = append(result[rule.Reference], relatedEntities...)
// 				mu.Unlock()
// 			}
// 			return nil
// 		})
// 	}

// 	// Check if this entity matches the "to" selector
// 	toMatches, _ := r.matchesSelector(ctx, rule.ToType, rule.ToSelector, entity)
// 	// If entity is on the "to" side, find matching "from" entities
// 	if toMatches && !fromMatches {
// 		g.Go(func() error {
// 			fromEntities, err := r.findMatchingEntities(ctx, rule, rule.FromType, rule.FromSelector, entity, false)
// 			if err != nil {
// 				return err
// 			}
// 			if len(fromEntities) > 0 {
// 				relatedEntities := make([]*oapi.EntityRelation, 0, len(fromEntities))
// 				for _, fromEntity := range fromEntities {
// 					relatedEntities = append(relatedEntities, &oapi.EntityRelation{
// 						Rule:       rule,
// 						Direction:  oapi.From,
// 						EntityType: rule.FromType,
// 						EntityId:   fromEntity.GetID(),
// 						Entity:     *fromEntity,
// 					})
// 				}

// 				mu.Lock()
// 				result[rule.Reference] = append(result[rule.Reference], relatedEntities...)
// 				mu.Unlock()
// 			}
// 			return nil
// 		})
// 	}
// }

// if err := g.Wait(); err != nil {
// 	return nil, err
// }

// return result, nil
// }

// findMatchingEntities is a helper function that finds entities matching a selector and property matchers
// This function uses parallel processing to improve performance with large entity counts
// func (r *RelationshipRules) findMatchingEntities(
// 	ctx context.Context,
// 	rule *oapi.RelationshipRule,
// 	entityType oapi.RelatableEntityType,
// 	entitySelector *oapi.Selector,
// 	sourceEntity *oapi.RelatableEntity,
// 	evaluateFromTo bool, // true = evaluate(source, target), false = evaluate(target, source)
// ) ([]*oapi.RelatableEntity, error) {
// 	ctx, span := relationshipsTracer.Start(ctx, "findMatchingEntities")
// 	defer span.End()

// 	switch entityType {
// 	case "deployment":
// 		return r.findMatchingDeployments(ctx, rule, entitySelector, sourceEntity, evaluateFromTo)
// 	case "environment":
// 		return r.findMatchingEnvironments(ctx, rule, entitySelector, sourceEntity, evaluateFromTo)
// 	case "resource":
// 		return r.findMatchingResources(ctx, rule, entitySelector, sourceEntity, evaluateFromTo)
// 	default:
// 		return nil, fmt.Errorf("unknown entity type: %s", entityType)
// 	}
// }

// func (r *RelationshipRules) findMatchingDeployments(
// 	ctx context.Context,
// 	rule *oapi.RelationshipRule,
// 	entitySelector *oapi.Selector,
// 	sourceEntity *oapi.RelatableEntity,
// 	evaluateFromTo bool,
// ) ([]*oapi.RelatableEntity, error) {
// 	ctx, span := relationshipsTracer.Start(ctx, "findMatchingDeployments")
// 	defer span.End()

// 	deployments := r.store.Deployments.Items()
// 	if len(deployments) == 0 {
// 		return nil, nil
// 	}

// 	// Convert map to slice for processing
// 	_, sliceSpan := relationshipsTracer.Start(ctx, "findMatchingDeployments.convertToSlice")
// 	deploymentSlice := make([]*oapi.Deployment, 0, len(deployments))
// 	for _, deployment := range deployments {
// 		deploymentSlice = append(deploymentSlice, deployment)
// 	}
// 	sliceSpan.SetAttributes(attribute.Int("deployment_count", len(deploymentSlice)))
// 	sliceSpan.End()

// 	// Track matching metrics
// 	var (
// 		entitySelectorMatches int
// 		entitySelectorMisses  int
// 		ruleMisses            int
// 		finalMatches          int
// 	)

// 	// Process function for each deployment
// 	processFn := func(deployment *oapi.Deployment) (*oapi.RelatableEntity, error) {
// 		_, entitySpan := relationshipsTracer.Start(ctx, "findMatchingDeployments.processDeployment")
// 		defer entitySpan.End()

// 		deploymentEntity := relationships.NewDeploymentEntity(deployment)

// 		if entitySelector != nil {
// 			_, selectorSpan := relationshipsTracer.Start(ctx, "findMatchingDeployments.entitySelectorMatch")
// 			matched, err := selector.Match(ctx, entitySelector, deploymentEntity.Item())
// 			selectorSpan.SetAttributes(
// 				attribute.Bool("matched", matched),
// 				attribute.String("deployment_id", deployment.Id),
// 			)
// 			selectorSpan.End()

// 			if err != nil {
// 				return nil, err
// 			}
// 			if !matched {
// 				entitySelectorMisses++
// 				return nil, nil // No match, skip
// 			}
// 			entitySelectorMatches++
// 		}

// 		_, matcherSpan := relationshipsTracer.Start(ctx, "findMatchingDeployments.ruleMatcherMatch")
// 		var matches bool
// 		if evaluateFromTo {
// 			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, deploymentEntity)
// 		} else {
// 			matches = relationships.Matches(ctx, &rule.Matcher, deploymentEntity, sourceEntity)
// 		}
// 		matcherSpan.SetAttributes(
// 			attribute.Bool("matched", matches),
// 			attribute.String("deployment_id", deployment.Id),
// 			attribute.Bool("evaluate_from_to", evaluateFromTo),
// 		)
// 		matcherSpan.End()

// 		if !matches {
// 			ruleMisses++
// 			return nil, nil // No match, skip
// 		}

// 		finalMatches++
// 		return deploymentEntity, nil
// 	}

// 	// Use parallel processing for large datasets
// 	const parallelThreshold = 100
// 	const chunkSize = 50
// 	const maxConcurrency = 8

// 	var results []*oapi.RelatableEntity
// 	var err error

// 	if len(deploymentSlice) < parallelThreshold {
// 		// Sequential processing for small datasets
// 		_, processingSpan := relationshipsTracer.Start(ctx, "findMatchingDeployments.sequentialProcessing")
// 		results = make([]*oapi.RelatableEntity, 0, 8)
// 		for _, deployment := range deploymentSlice {
// 			entity, err := processFn(deployment)
// 			if err != nil {
// 				processingSpan.End()
// 				return nil, err
// 			}
// 			if entity != nil {
// 				results = append(results, entity)
// 			}
// 		}
// 		processingSpan.SetAttributes(
// 			attribute.Int("total_processed", len(deploymentSlice)),
// 			attribute.Int("entity_selector_matches", entitySelectorMatches),
// 			attribute.Int("entity_selector_misses", entitySelectorMisses),
// 			attribute.Int("rule_matcher_misses", ruleMisses),
// 			attribute.Int("final_matches", finalMatches),
// 		)
// 		processingSpan.End()
// 	} else {
// 		// Parallel processing for large datasets
// 		_, processingSpan := relationshipsTracer.Start(ctx, "findMatchingDeployments.parallelProcessing")
// 		processingSpan.SetAttributes(
// 			attribute.Int("chunk_size", chunkSize),
// 			attribute.Int("max_concurrency", maxConcurrency),
// 		)
// 		results, err = concurrency.ProcessInChunks(deploymentSlice, chunkSize, maxConcurrency, processFn)
// 		processingSpan.SetAttributes(
// 			attribute.Int("total_processed", len(deploymentSlice)),
// 			attribute.Int("entity_selector_matches", entitySelectorMatches),
// 			attribute.Int("entity_selector_misses", entitySelectorMisses),
// 			attribute.Int("rule_matcher_misses", ruleMisses),
// 			attribute.Int("final_matches", finalMatches),
// 		)
// 		processingSpan.End()
// 		if err != nil {
// 			return nil, err
// 		}
// 	}

// 	span.SetAttributes(
// 		attribute.Int("repo.deployment_count", len(deploymentSlice)),
// 		attribute.Int("results.count", len(results)),
// 		attribute.Int("entity_selector_matches", entitySelectorMatches),
// 		attribute.Int("entity_selector_misses", entitySelectorMisses),
// 		attribute.Int("rule_matcher_misses", ruleMisses),
// 		attribute.Bool("used_parallel", len(deploymentSlice) >= parallelThreshold),
// 	)

// 	// Filter out nil results
// 	filtered := make([]*oapi.RelatableEntity, 0, len(results))
// 	for _, entity := range results {
// 		if entity != nil {
// 			filtered = append(filtered, entity)
// 		}
// 	}

// 	return filtered, nil
// }

// func (r *RelationshipRules) findMatchingEnvironments(
// 	ctx context.Context,
// 	rule *oapi.RelationshipRule,
// 	entitySelector *oapi.Selector,
// 	sourceEntity *oapi.RelatableEntity,
// 	evaluateFromTo bool,
// ) ([]*oapi.RelatableEntity, error) {
// 	ctx, span := relationshipsTracer.Start(ctx, "findMatchingEnvironments")
// 	defer span.End()

// 	environments := r.store.Environments.Items()
// 	if len(environments) == 0 {
// 		return nil, nil
// 	}

// 	// Convert map to slice for processing
// 	_, sliceSpan := relationshipsTracer.Start(ctx, "findMatchingEnvironments.convertToSlice")
// 	environmentSlice := make([]*oapi.Environment, 0, len(environments))
// 	for _, environment := range environments {
// 		environmentSlice = append(environmentSlice, environment)
// 	}
// 	sliceSpan.SetAttributes(attribute.Int("environment_count", len(environmentSlice)))
// 	sliceSpan.End()

// 	// Track matching metrics
// 	var (
// 		entitySelectorMatches int
// 		entitySelectorMisses  int
// 		ruleMisses            int
// 		finalMatches          int
// 	)

// 	// Process function for each environment
// 	processFn := func(environment *oapi.Environment) (*oapi.RelatableEntity, error) {
// 		_, entitySpan := relationshipsTracer.Start(ctx, "findMatchingEnvironments.processEnvironment")
// 		defer entitySpan.End()

// 		environmentEntity := relationships.NewEnvironmentEntity(environment)

// 		if entitySelector != nil {
// 			_, selectorSpan := relationshipsTracer.Start(ctx, "findMatchingEnvironments.entitySelectorMatch")
// 			matched, err := selector.Match(ctx, entitySelector, environmentEntity.Item())
// 			selectorSpan.SetAttributes(
// 				attribute.Bool("matched", matched),
// 				attribute.String("environment_id", environment.Id),
// 			)
// 			selectorSpan.End()

// 			if err != nil {
// 				return nil, err
// 			}
// 			if !matched {
// 				entitySelectorMisses++
// 				return nil, nil // No match, skip
// 			}
// 			entitySelectorMatches++
// 		}

// 		_, matcherSpan := relationshipsTracer.Start(ctx, "findMatchingEnvironments.ruleMatcherMatch")
// 		var matches bool
// 		if evaluateFromTo {
// 			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, environmentEntity)
// 		} else {
// 			matches = relationships.Matches(ctx, &rule.Matcher, environmentEntity, sourceEntity)
// 		}
// 		matcherSpan.SetAttributes(
// 			attribute.Bool("matched", matches),
// 			attribute.String("environment_id", environment.Id),
// 			attribute.Bool("evaluate_from_to", evaluateFromTo),
// 		)
// 		matcherSpan.End()

// 		if !matches {
// 			ruleMisses++
// 			return nil, nil // No match, skip
// 		}

// 		finalMatches++
// 		return environmentEntity, nil
// 	}

// 	// Use parallel processing for large datasets
// 	const parallelThreshold = 100
// 	const chunkSize = 50
// 	const maxConcurrency = 8

// 	var results []*oapi.RelatableEntity
// 	var err error

// 	if len(environmentSlice) < parallelThreshold {
// 		// Sequential processing for small datasets
// 		_, processingSpan := relationshipsTracer.Start(ctx, "findMatchingEnvironments.sequentialProcessing")
// 		results = make([]*oapi.RelatableEntity, 0, 8)
// 		for _, environment := range environmentSlice {
// 			entity, err := processFn(environment)
// 			if err != nil {
// 				processingSpan.End()
// 				return nil, err
// 			}
// 			if entity != nil {
// 				results = append(results, entity)
// 			}
// 		}
// 		processingSpan.SetAttributes(
// 			attribute.Int("total_processed", len(environmentSlice)),
// 			attribute.Int("entity_selector_matches", entitySelectorMatches),
// 			attribute.Int("entity_selector_misses", entitySelectorMisses),
// 			attribute.Int("rule_matcher_misses", ruleMisses),
// 			attribute.Int("final_matches", finalMatches),
// 		)
// 		processingSpan.End()
// 	} else {
// 		// Parallel processing for large datasets
// 		_, processingSpan := relationshipsTracer.Start(ctx, "findMatchingEnvironments.parallelProcessing")
// 		processingSpan.SetAttributes(
// 			attribute.Int("chunk_size", chunkSize),
// 			attribute.Int("max_concurrency", maxConcurrency),
// 		)
// 		results, err = concurrency.ProcessInChunks(environmentSlice, chunkSize, maxConcurrency, processFn)
// 		processingSpan.SetAttributes(
// 			attribute.Int("total_processed", len(environmentSlice)),
// 			attribute.Int("entity_selector_matches", entitySelectorMatches),
// 			attribute.Int("entity_selector_misses", entitySelectorMisses),
// 			attribute.Int("rule_matcher_misses", ruleMisses),
// 			attribute.Int("final_matches", finalMatches),
// 		)
// 		processingSpan.End()
// 		if err != nil {
// 			return nil, err
// 		}
// 	}

// 	span.SetAttributes(
// 		attribute.Int("repo.environment_count", len(environmentSlice)),
// 		attribute.Int("results.count", len(results)),
// 		attribute.Int("entity_selector_matches", entitySelectorMatches),
// 		attribute.Int("entity_selector_misses", entitySelectorMisses),
// 		attribute.Int("rule_matcher_misses", ruleMisses),
// 		attribute.Bool("used_parallel", len(environmentSlice) >= parallelThreshold),
// 	)

// 	// Filter out nil results
// 	filtered := make([]*oapi.RelatableEntity, 0, len(results))
// 	for _, entity := range results {
// 		if entity != nil {
// 			filtered = append(filtered, entity)
// 		}
// 	}

// 	return filtered, nil
// }

// func (r *RelationshipRules) findMatchingResources(
// 	ctx context.Context,
// 	rule *oapi.RelationshipRule,
// 	entitySelector *oapi.Selector,
// 	sourceEntity *oapi.RelatableEntity,
// 	evaluateFromTo bool,
// ) ([]*oapi.RelatableEntity, error) {
// 	ctx, span := relationshipsTracer.Start(ctx, "findMatchingResources")
// 	defer span.End()

// 	resources := r.store.Resources.Items()
// 	if len(resources) == 0 {
// 		return nil, nil
// 	}

// 	resourceSlice := make([]*oapi.Resource, 0, len(resources))
// 	for _, resource := range resources {
// 		resourceSlice = append(resourceSlice, resource)
// 	}

// 	// Track matching metrics
// 	var (
// 		entitySelectorMatches int
// 		entitySelectorMisses  int
// 		ruleMisses            int
// 		finalMatches          int
// 	)

// 	// Process function for each resource
// 	processFn := func(resource *oapi.Resource) (*oapi.RelatableEntity, error) {
// 		_, entitySpan := relationshipsTracer.Start(ctx, "findMatchingResources.processResource")
// 		defer entitySpan.End()

// 		resourceEntity := relationships.NewResourceEntity(resource)

// 		if entitySelector != nil {
// 			_, selectorSpan := relationshipsTracer.Start(ctx, "findMatchingResources.entitySelectorMatch")
// 			matched, err := selector.Match(ctx, entitySelector, resourceEntity.Item())
// 			selectorSpan.SetAttributes(
// 				attribute.Bool("matched", matched),
// 				attribute.String("resource_id", resource.Id),
// 			)
// 			selectorSpan.End()

// 			if err != nil {
// 				return nil, err
// 			}
// 			if !matched {
// 				entitySelectorMisses++
// 				return nil, nil // No match, skip
// 			}
// 			entitySelectorMatches++
// 		}

// 		_, matcherSpan := relationshipsTracer.Start(ctx, "findMatchingResources.ruleMatcherMatch")
// 		var matches bool
// 		if evaluateFromTo {
// 			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, resourceEntity)
// 		} else {
// 			matches = relationships.Matches(ctx, &rule.Matcher, resourceEntity, sourceEntity)
// 		}
// 		matcherSpan.SetAttributes(
// 			attribute.Bool("matched", matches),
// 			attribute.String("resource_id", resource.Id),
// 			attribute.Bool("evaluate_from_to", evaluateFromTo),
// 		)
// 		matcherSpan.End()

// 		if !matches {
// 			ruleMisses++
// 			return nil, nil // No match, skip
// 		}

// 		finalMatches++
// 		return resourceEntity, nil
// 	}

// 	// Use parallel processing for large datasets
// 	const parallelThreshold = 100
// 	const chunkSize = 50
// 	const maxConcurrency = 8

// 	var results []*oapi.RelatableEntity
// 	var err error

// 	if len(resourceSlice) < parallelThreshold {
// 		// Sequential processing for small datasets
// 		_, processingSpan := relationshipsTracer.Start(ctx, "findMatchingResources.sequentialProcessing")
// 		results = make([]*oapi.RelatableEntity, 0, 8)
// 		for _, resource := range resourceSlice {
// 			entity, err := processFn(resource)
// 			if err != nil {
// 				processingSpan.End()
// 				return nil, err
// 			}
// 			if entity != nil {
// 				results = append(results, entity)
// 			}
// 		}
// 		processingSpan.SetAttributes(
// 			attribute.Int("total_processed", len(resourceSlice)),
// 			attribute.Int("entity_selector_matches", entitySelectorMatches),
// 			attribute.Int("entity_selector_misses", entitySelectorMisses),
// 			attribute.Int("rule_matcher_misses", ruleMisses),
// 			attribute.Int("final_matches", finalMatches),
// 		)
// 		processingSpan.End()
// 	} else {
// 		// Parallel processing for large datasets
// 		_, processingSpan := relationshipsTracer.Start(ctx, "findMatchingResources.parallelProcessing")
// 		processingSpan.SetAttributes(
// 			attribute.Int("chunk_size", chunkSize),
// 			attribute.Int("max_concurrency", maxConcurrency),
// 		)
// 		results, err = concurrency.ProcessInChunks(resourceSlice, chunkSize, maxConcurrency, processFn)
// 		processingSpan.SetAttributes(
// 			attribute.Int("total_processed", len(resourceSlice)),
// 			attribute.Int("entity_selector_matches", entitySelectorMatches),
// 			attribute.Int("entity_selector_misses", entitySelectorMisses),
// 			attribute.Int("rule_matcher_misses", ruleMisses),
// 			attribute.Int("final_matches", finalMatches),
// 		)
// 		processingSpan.End()
// 		if err != nil {
// 			return nil, err
// 		}
// 	}

// 	span.SetAttributes(
// 		attribute.Int("repo.resource_count", len(resourceSlice)),
// 		attribute.Int("results.count", len(results)),
// 		attribute.Int("entity_selector_matches", entitySelectorMatches),
// 		attribute.Int("entity_selector_misses", entitySelectorMisses),
// 		attribute.Int("rule_matcher_misses", ruleMisses),
// 		attribute.Bool("used_parallel", len(resourceSlice) >= parallelThreshold),
// 	)

// 	// Filter out nil results
// 	filtered := make([]*oapi.RelatableEntity, 0, len(results))
// 	for _, entity := range results {
// 		if entity != nil {
// 			filtered = append(filtered, entity)
// 		}
// 	}

// 	return filtered, nil
// }

func (r *RelationshipRules) findMatchingResourcesBasic(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
	resources []*oapi.Resource,
) ([]*oapi.RelatableEntity, error) {
	ctx, span := relationshipsTracer.Start(ctx, "findMatchingResourcesBasic")
	defer span.End()

	if len(resources) == 0 {
		return nil, nil
	}

	results := make([]*oapi.RelatableEntity, 0)

	for _, resource := range resources {
		// Check entity selector if provided
		if entitySelector != nil {
			matched, err := selector.Match(ctx, entitySelector, resource)
			if err != nil {
				return nil, err
			}
			if !matched {
				continue
			}
		}

		resourceEntity := relationships.NewResourceEntity(resource)

		// Check matcher rule
		var matches bool
		if evaluateFromTo {
			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, resourceEntity)
		} else {
			matches = relationships.Matches(ctx, &rule.Matcher, resourceEntity, sourceEntity)
		}

		if !matches {
			continue
		}

		results = append(results, resourceEntity)
	}

	return results, nil
}
