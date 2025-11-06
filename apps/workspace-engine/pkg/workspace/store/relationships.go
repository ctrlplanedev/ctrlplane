package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
)

type StoreEntityProvider struct {
	store *Store
}

func (s *StoreEntityProvider) GetResources() map[string]*oapi.Resource {
	return s.store.repo.Resources.Items()
}

func (s *StoreEntityProvider) GetDeployments() map[string]*oapi.Deployment {
	return s.store.repo.Deployments.Items()
}

func (s *StoreEntityProvider) GetEnvironments() map[string]*oapi.Environment {
	return s.store.repo.Environments.Items()
}

func (s *StoreEntityProvider) GetRelationshipRules() map[string]*oapi.RelationshipRule {
	return s.store.repo.RelationshipRules.Items()
}

func (s *StoreEntityProvider) GetRelationshipRule(reference string) (*oapi.RelationshipRule, bool) {
	return s.store.repo.RelationshipRules.Get(reference)
}

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

func (r *RelationshipRules) Remove(ctx context.Context, id string) error {
	relationship, ok := r.repo.RelationshipRules.Get(id)
	if !ok || relationship == nil {
		return nil
	}

	r.repo.RelationshipRules.Remove(id)
	r.store.changeset.RecordDelete(relationship)

	return nil
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

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
			rules = append(rules, rule)
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
			rules = append(rules, rule)
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

func (r *RelationshipRules) getAllResources() []*oapi.Resource {
	resources := r.store.Resources.Items()
	resourceSlice := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourceSlice = append(resourceSlice, resource)
	}
	return resourceSlice
}

func (r *RelationshipRules) getAllDeployments() []*oapi.Deployment {
	deployments := r.store.Deployments.Items()
	deploymentSlice := make([]*oapi.Deployment, 0, len(deployments))
	for _, deployment := range deployments {
		deploymentSlice = append(deploymentSlice, deployment)
	}
	return deploymentSlice
}

func (r *RelationshipRules) getAllEnvironments() []*oapi.Environment {
	environments := r.store.Environments.Items()
	environmentSlice := make([]*oapi.Environment, 0, len(environments))
	for _, environment := range environments {
		environmentSlice = append(environmentSlice, environment)
	}
	return environmentSlice
}

func (r *RelationshipRules) GetRelatedEntities(
	ctx context.Context,
	entity *oapi.RelatableEntity,
) (
	map[string][]*oapi.EntityRelation,
	error,
) {
	ctx, span := tracer.Start(ctx, "RelationshipRules.GetRelatedEntities")
	defer span.End()

	entityID := entity.GetID()
	entityType := entity.GetType()
	
	span.SetAttributes(
		attribute.String("entity_id", entityID),
		attribute.String("entity_type", string(entityType)),
	)

	result := make(map[string][]*oapi.EntityRelation)

	// Phase 1: Collect applicable rules
	span.AddEvent("Collecting relationship rules")
	allRules := r.repo.RelationshipRules.Items()
	span.SetAttributes(attribute.Int("total_rules", len(allRules)))
	
	fromRules, err := r.collectFromRules(ctx, allRules, entity)
	if err != nil {
		span.RecordError(err)
		log.Error("Failed to collect from rules", 
			"entity_id", entityID,
			"error", err.Error())
		return nil, err
	}
	span.SetAttributes(attribute.Int("from_rules_count", len(fromRules)))
	
	toRules, err := r.collectToRules(ctx, allRules, entity)
	if err != nil {
		span.RecordError(err)
		log.Error("Failed to collect to rules", 
			"entity_id", entityID,
			"error", err.Error())
		return nil, err
	}
	span.SetAttributes(attribute.Int("to_rules_count", len(toRules)))

	log.Debug("Collected relationship rules",
		"entity_id", entityID,
		"from_rules", len(fromRules),
		"to_rules", len(toRules))

	// Phase 2: Resolve relations from rules
	span.AddEvent("Resolving from relations")
	fromRelations, err := r.collectFromRelations(ctx, fromRules, entity)
	if err != nil {
		span.RecordError(err)
		log.Error("Failed to collect from relations", 
			"entity_id", entityID,
			"error", err.Error())
		return nil, err
	}
	
	fromRelationsCount := 0
	for _, relations := range fromRelations {
		fromRelationsCount += len(relations)
	}
	span.SetAttributes(attribute.Int("from_relations_count", fromRelationsCount))

	span.AddEvent("Resolving to relations")
	toRelations, err := r.collectToRelations(ctx, toRules, entity)
	if err != nil {
		span.RecordError(err)
		log.Error("Failed to collect to relations", 
			"entity_id", entityID,
			"error", err.Error())
		return nil, err
	}
	
	toRelationsCount := 0
	for _, relations := range toRelations {
		toRelationsCount += len(relations)
	}
	span.SetAttributes(attribute.Int("to_relations_count", toRelationsCount))

	// Phase 3: Merge results
	span.AddEvent("Merging relations")
	for ref, relations := range fromRelations {
		result[ref] = append(result[ref], relations...)
	}

	for ref, relations := range toRelations {
		result[ref] = append(result[ref], relations...)
	}

	totalRelations := 0
	uniqueRefs := 0
	for _, relations := range result {
		totalRelations += len(relations)
		uniqueRefs++
	}
	
	span.SetAttributes(
		attribute.Int("total_relations", totalRelations),
		attribute.Int("unique_refs", uniqueRefs),
	)

	return result, nil
}

func (r *RelationshipRules) collectFromRelations(
	ctx context.Context,
	fromRules []*oapi.RelationshipRule,
	entity *oapi.RelatableEntity,
) (map[string][]*oapi.EntityRelation, error) {
	result := make(map[string][]*oapi.EntityRelation)
	for _, rule := range fromRules {
		var toEntities []*oapi.RelatableEntity
		if rule.ToType == oapi.RelatableEntityTypeResource {
			toResources, err := r.findMatchingResources(ctx, rule, rule.ToSelector, entity, true)
			if err != nil {
				return nil, err
			}
			toEntities = append(toEntities, toResources...)
		}
		if rule.ToType == oapi.RelatableEntityTypeDeployment {
			toDeployments, err := r.findMatchingDeployments(ctx, rule, rule.ToSelector, entity, true)
			if err != nil {
				return nil, err
			}
			toEntities = append(toEntities, toDeployments...)
		}
		if rule.ToType == oapi.RelatableEntityTypeEnvironment {
			toEnvironments, err := r.findMatchingEnvironments(ctx, rule, rule.ToSelector, entity, true)
			if err != nil {
				return nil, err
			}
			toEntities = append(toEntities, toEnvironments...)
		}

		if len(toEntities) == 0 {
			continue
		}

		for _, toEntity := range toEntities {
			result[rule.Reference] = append(result[rule.Reference], &oapi.EntityRelation{
				Rule:       *rule,
				Direction:  oapi.To,
				EntityType: toEntity.GetType(),
				EntityId:   toEntity.GetID(),
				Entity:     *toEntity,
			})
		}
	}
	return result, nil
}

func (r *RelationshipRules) collectToRelations(
	ctx context.Context,
	toRules []*oapi.RelationshipRule,
	entity *oapi.RelatableEntity,
) (map[string][]*oapi.EntityRelation, error) {
	result := make(map[string][]*oapi.EntityRelation)
	for _, rule := range toRules {
		var fromEntities []*oapi.RelatableEntity
		if rule.FromType == oapi.RelatableEntityTypeResource {
			fromResources, err := r.findMatchingResources(ctx, rule, rule.FromSelector, entity, false)
			if err != nil {
				return nil, err
			}
			fromEntities = append(fromEntities, fromResources...)
		}

		if rule.FromType == oapi.RelatableEntityTypeDeployment {
			fromDeployments, err := r.findMatchingDeployments(ctx, rule, rule.FromSelector, entity, false)
			if err != nil {
				return nil, err
			}
			fromEntities = append(fromEntities, fromDeployments...)
		}

		if rule.FromType == oapi.RelatableEntityTypeEnvironment {
			fromEnvironments, err := r.findMatchingEnvironments(ctx, rule, rule.FromSelector, entity, false)
			if err != nil {
				return nil, err
			}
			fromEntities = append(fromEntities, fromEnvironments...)
		}

		if len(fromEntities) == 0 {
			continue
		}
		for _, fromEntity := range fromEntities {
			result[rule.Reference] = append(result[rule.Reference], &oapi.EntityRelation{
				Rule:       *rule,
				Direction:  oapi.From,
				EntityType: fromEntity.GetType(),
				EntityId:   fromEntity.GetID(),
				Entity:     *fromEntity,
			})
		}
	}
	return result, nil
}

func (r *RelationshipRules) findMatchingResources(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
) ([]*oapi.RelatableEntity, error) {
	resources := r.getAllResources()

	results := make([]*oapi.RelatableEntity, 0)

	for _, resource := range resources {
		if sourceEntity.GetType() == oapi.RelatableEntityTypeResource && sourceEntity.GetID() == resource.Id {
			continue
		}

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

func (r *RelationshipRules) findMatchingEnvironments(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
) ([]*oapi.RelatableEntity, error) {
	environments := r.getAllEnvironments()

	results := make([]*oapi.RelatableEntity, 0)

	for _, environment := range environments {
		if sourceEntity.GetType() == oapi.RelatableEntityTypeEnvironment && sourceEntity.GetID() == environment.Id {
			continue
		}
		// Check entity selector if provided
		if entitySelector != nil {
			matched, err := selector.Match(ctx, entitySelector, environment)
			if err != nil {
				return nil, err
			}
			if !matched {
				continue
			}
		}

		environmentEntity := relationships.NewEnvironmentEntity(environment)

		// Check matcher rule
		var matches bool
		if evaluateFromTo {
			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, environmentEntity)
		} else {
			matches = relationships.Matches(ctx, &rule.Matcher, environmentEntity, sourceEntity)
		}

		if !matches {
			continue
		}

		results = append(results, environmentEntity)
	}

	return results, nil
}

func (r *RelationshipRules) findMatchingDeployments(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool,
) ([]*oapi.RelatableEntity, error) {
	deployments := r.getAllDeployments()

	results := make([]*oapi.RelatableEntity, 0)

	for _, deployment := range deployments {
		if sourceEntity.GetType() == oapi.RelatableEntityTypeDeployment && sourceEntity.GetID() == deployment.Id {
			continue
		}
		// Check entity selector if provided
		if entitySelector != nil {
			matched, err := selector.Match(ctx, entitySelector, deployment)
			if err != nil {
				return nil, err
			}
			if !matched {
				continue
			}
		}

		deploymentEntity := relationships.NewDeploymentEntity(deployment)

		// Check matcher rule
		var matches bool
		if evaluateFromTo {
			matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, deploymentEntity)
		} else {
			matches = relationships.Matches(ctx, &rule.Matcher, deploymentEntity, sourceEntity)
		}

		if !matches {
			continue
		}

		results = append(results, deploymentEntity)
	}

	return results, nil
}
