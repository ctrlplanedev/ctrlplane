package store

import (
	"context"
	"fmt"
	"sync"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel"
)

var (
	relationshipsTracer = otel.Tracer("workspace/store/relationships")
)

func NewRelationshipRules(store *Store) *RelationshipRules {
	return &RelationshipRules{
		repo:  store.repo,
		store: store,
	}
}

type RelationshipRules struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, relationship)
	}

	r.store.changeset.RecordUpsert(relationship)
	return nil
}

func (r *RelationshipRules) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Has(id string) bool {
	return r.repo.RelationshipRules.Has(id)
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) {
	relationship, ok := r.repo.RelationshipRules.Get(id)
	if !ok || relationship == nil {
		return
	}

	r.repo.RelationshipRules.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, relationship)
	}

	r.store.changeset.RecordDelete(relationship)
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

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

// GetRelatedEntities returns all entities related to the given entity, grouped by relationship reference.
// This includes relationships where the entity is the "from" side (outgoing) or "to" side (incoming).
func (r *RelationshipRules) GetRelatedEntities(
	ctx context.Context,
	entity *oapi.RelatableEntity,
) (
	map[string][]*oapi.EntityRelation,
	error,
) {
	ctx, span := relationshipsTracer.Start(ctx, "GetRelatedEntities")
	defer span.End()

	result := make(map[string][]*oapi.EntityRelation)
	entityType := entity.GetType()

	var wg sync.WaitGroup
	var mu sync.Mutex

	// Find all relationship rules where this entity matches
	for _, rule := range r.repo.RelationshipRules.Items() {
		// Early exit: skip rules that don't involve this entity type
		if rule.FromType != entityType && rule.ToType != entityType {
			continue
		}

		// Check if this entity matches the "from" selector
		fromMatches, err := r.matchesSelector(ctx, rule.FromType, rule.FromSelector, entity)
		if err != nil {
			return nil, err
		}

		// If entity is on the "from" side, find matching "to" entities
		if fromMatches {
			wg.Add(1)
			go func() {
				defer wg.Done()
				toEntities, err := r.findMatchingEntities(ctx, rule, rule.ToType, rule.ToSelector, entity, true)
				if err != nil {
					return
				}
				if len(toEntities) > 0 {
					relatedEntities := make([]*oapi.EntityRelation, 0, len(toEntities))
					for _, toEntity := range toEntities {
						relatedEntities = append(relatedEntities, &oapi.EntityRelation{
							Rule:       rule,
							Direction:  oapi.To,
							EntityType: toEntity.GetType(),
							EntityId:   toEntity.GetID(),
							Entity:     *toEntity,
						})
					}

					mu.Lock()
					result[rule.Reference] = append(result[rule.Reference], relatedEntities...)
					mu.Unlock()
				}
			}()
		}

		// Check if this entity matches the "to" selector
		toMatches, err := r.matchesSelector(ctx, rule.ToType, rule.ToSelector, entity)
		if err != nil {
			return nil, err
		}

		// If entity is on the "to" side, find matching "from" entities
		if toMatches && !fromMatches {
			wg.Add(1)
			go func() {
				defer wg.Done()
				fromEntities, err := r.findMatchingEntities(ctx, rule, rule.FromType, rule.FromSelector, entity, false)
				if err != nil {
					return
				}
				if len(fromEntities) > 0 {
					relatedEntities := make([]*oapi.EntityRelation, 0, len(fromEntities))
					for _, fromEntity := range fromEntities {
						relatedEntities = append(relatedEntities, &oapi.EntityRelation{
							Rule:       rule,
							Direction:  oapi.From,
							EntityType: rule.FromType,
							EntityId:   fromEntity.GetID(),
							Entity:     *fromEntity,
						})
					}

					mu.Lock()
					result[rule.Reference] = append(result[rule.Reference], relatedEntities...)
					mu.Unlock()
				}
			}()
		}
	}

	wg.Wait()

	return result, nil
}

// findMatchingEntities is a helper function that finds entities matching a selector and property matchers
// This function uses parallel processing to improve performance with large entity counts
func (r *RelationshipRules) findMatchingEntities(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entityType oapi.RelatableEntityType,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool, // true = evaluate(source, target), false = evaluate(target, source)
) ([]*oapi.RelatableEntity, error) {
	ctx, span := relationshipsTracer.Start(ctx, "findMatchingEntities")
	defer span.End()

	switch entityType {
	case "deployment":
		return r.findMatchingDeployments(ctx, rule, entitySelector, sourceEntity, evaluateFromTo)
	case "environment":
		return r.findMatchingEnvironments(ctx, rule, entitySelector, sourceEntity, evaluateFromTo)
	case "resource":
		return r.findMatchingResources(ctx, rule, entitySelector, sourceEntity, evaluateFromTo)
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}
}

func (r *RelationshipRules) findMatchingDeployments(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
) ([]*oapi.RelatableEntity, error) {
	deployments := r.store.Deployments.Items()
	if len(deployments) == 0 {
		return nil, nil
	}

	// Convert map to slice for processing
	deploymentSlice := make([]*oapi.Deployment, 0, len(deployments))
	for _, deployment := range deployments {
		deploymentSlice = append(deploymentSlice, deployment)
	}

	// Process function for each deployment
	processFn := func(deployment *oapi.Deployment) (*oapi.RelatableEntity, error) {
		deploymentEntity := relationships.NewDeploymentEntity(deployment)
		
		if entitySelector != nil {
			matched, err := selector.Match(ctx, entitySelector, deploymentEntity.Item())
			if err != nil {
				return nil, err
			}
			if !matched {
				return nil, nil // No match, skip
			}
		}

		var matches bool
		if evaluateFromTo {
			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, deploymentEntity)
		} else {
			matches = relationships.Matches(ctx, &rule.Matcher, deploymentEntity, sourceEntity)
		}
		
		if !matches {
			return nil, nil // No match, skip
		}

		return deploymentEntity, nil
	}

	// Use parallel processing for large datasets
	const parallelThreshold = 100
	const chunkSize = 50
	const maxConcurrency = 8

	var results []*oapi.RelatableEntity
	var err error

	if len(deploymentSlice) < parallelThreshold {
		// Sequential processing for small datasets
		results = make([]*oapi.RelatableEntity, 0, 8)
		for _, deployment := range deploymentSlice {
			entity, err := processFn(deployment)
			if err != nil {
				return nil, err
			}
			if entity != nil {
				results = append(results, entity)
			}
		}
	} else {
		// Parallel processing for large datasets
		results, err = concurrency.ProcessInChunks(deploymentSlice, chunkSize, maxConcurrency, processFn)
		if err != nil {
			return nil, err
		}
	}

	// Filter out nil results
	filtered := make([]*oapi.RelatableEntity, 0, len(results))
	for _, entity := range results {
		if entity != nil {
			filtered = append(filtered, entity)
		}
	}

	return filtered, nil
}

func (r *RelationshipRules) findMatchingEnvironments(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
) ([]*oapi.RelatableEntity, error) {
	environments := r.store.Environments.Items()
	if len(environments) == 0 {
		return nil, nil
	}

	// Convert map to slice for processing
	environmentSlice := make([]*oapi.Environment, 0, len(environments))
	for _, environment := range environments {
		environmentSlice = append(environmentSlice, environment)
	}

	// Process function for each environment
	processFn := func(environment *oapi.Environment) (*oapi.RelatableEntity, error) {
		environmentEntity := relationships.NewEnvironmentEntity(environment)
		
		if entitySelector != nil {
			matched, err := selector.Match(ctx, entitySelector, environmentEntity.Item())
			if err != nil {
				return nil, err
			}
			if !matched {
				return nil, nil // No match, skip
			}
		}

		var matches bool
		if evaluateFromTo {
			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, environmentEntity)
		} else {
			matches = relationships.Matches(ctx, &rule.Matcher, environmentEntity, sourceEntity)
		}
		
		if !matches {
			return nil, nil // No match, skip
		}

		return environmentEntity, nil
	}

	// Use parallel processing for large datasets
	const parallelThreshold = 100
	const chunkSize = 50
	const maxConcurrency = 8

	var results []*oapi.RelatableEntity
	var err error

	if len(environmentSlice) < parallelThreshold {
		// Sequential processing for small datasets
		results = make([]*oapi.RelatableEntity, 0, 8)
		for _, environment := range environmentSlice {
			entity, err := processFn(environment)
			if err != nil {
				return nil, err
			}
			if entity != nil {
				results = append(results, entity)
			}
		}
	} else {
		// Parallel processing for large datasets
		results, err = concurrency.ProcessInChunks(environmentSlice, chunkSize, maxConcurrency, processFn)
		if err != nil {
			return nil, err
		}
	}

	// Filter out nil results
	filtered := make([]*oapi.RelatableEntity, 0, len(results))
	for _, entity := range results {
		if entity != nil {
			filtered = append(filtered, entity)
		}
	}

	return filtered, nil
}

func (r *RelationshipRules) findMatchingResources(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
) ([]*oapi.RelatableEntity, error) {
	resources := r.store.Resources.Items()
	if len(resources) == 0 {
		return nil, nil
	}

	// Convert map to slice for processing
	resourceSlice := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourceSlice = append(resourceSlice, resource)
	}

	// Process function for each resource
	processFn := func(resource *oapi.Resource) (*oapi.RelatableEntity, error) {
		resourceEntity := relationships.NewResourceEntity(resource)
		
		if entitySelector != nil {
			matched, err := selector.Match(ctx, entitySelector, resourceEntity.Item())
			if err != nil {
				return nil, err
			}
			if !matched {
				return nil, nil // No match, skip
			}
		}

		var matches bool
		if evaluateFromTo {
			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, resourceEntity)
		} else {
			matches = relationships.Matches(ctx, &rule.Matcher, resourceEntity, sourceEntity)
		}
		
		if !matches {
			return nil, nil // No match, skip
		}

		return resourceEntity, nil
	}

	// Use parallel processing for large datasets
	const parallelThreshold = 100
	const chunkSize = 50
	const maxConcurrency = 8

	var results []*oapi.RelatableEntity
	var err error

	if len(resourceSlice) < parallelThreshold {
		// Sequential processing for small datasets
		results = make([]*oapi.RelatableEntity, 0, 8)
		for _, resource := range resourceSlice {
			entity, err := processFn(resource)
			if err != nil {
				return nil, err
			}
			if entity != nil {
				results = append(results, entity)
			}
		}
	} else {
		// Parallel processing for large datasets
		results, err = concurrency.ProcessInChunks(resourceSlice, chunkSize, maxConcurrency, processFn)
		if err != nil {
			return nil, err
		}
	}

	// Filter out nil results
	filtered := make([]*oapi.RelatableEntity, 0, len(results))
	for _, entity := range results {
		if entity != nil {
			filtered = append(filtered, entity)
		}
	}

	return filtered, nil
}
