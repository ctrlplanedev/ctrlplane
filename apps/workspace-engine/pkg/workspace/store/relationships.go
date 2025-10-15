package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewRelationshipRules(store *Store) *RelationshipRules {
	return &RelationshipRules{
		repo:  store.repo,
		store: store,
	}
}

type RelationshipRules struct {
	repo  *repository.Repository
	store *Store
}

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeCreate, relationship)
	}
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
	if !ok { return }

	r.repo.RelationshipRules.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, relationship)
	}
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

// GetRelatedEntities returns all entities related to the given entity, grouped by relationship reference.
// This includes relationships where the entity is the "from" side (outgoing) or "to" side (incoming).
func (r *RelationshipRules) GetRelatedEntities(ctx context.Context, entity *relationships.Entity) (map[string][]*relationships.Entity, error) {
	result := make(map[string][]*relationships.Entity)

	entityItem := entity.Item()
	if entityItem == nil {
		return nil, fmt.Errorf("entity item is nil")
	}

	// Find all relationship rules where this entity matches
	for _, rule := range r.repo.RelationshipRules.Items() {
		// Check if this entity matches the "from" selector
		fromMatches := false
		if rule.FromType == entity.GetType() {
			if rule.FromSelector == nil {
				fromMatches = true
			} else {
				matched, err := selector.Match(ctx, rule.FromSelector, entityItem)
				if err != nil {
					return nil, err
				}
				fromMatches = matched
			}
		}

		// If entity is on the "from" side, find matching "to" entities
		if fromMatches {
			toEntities, err := r.findMatchingEntities(ctx, rule, rule.ToType, rule.ToSelector, entityItem, true)
			if err != nil {
				return nil, err
			}
			if len(toEntities) > 0 {
				result[rule.Reference] = append(result[rule.Reference], toEntities...)
			}
		}

		// Check if this entity matches the "to" selector
		toMatches := false
		if rule.ToType == entity.GetType() {
			if rule.ToSelector == nil {
				toMatches = true
			} else {
				matched, err := selector.Match(ctx, rule.ToSelector, entityItem)
				if err != nil {
					return nil, err
				}
				toMatches = matched
			}
		}

		// If entity is on the "to" side, find matching "from" entities
		if toMatches && !fromMatches {
			fromEntities, err := r.findMatchingEntities(ctx, rule, rule.FromType, rule.FromSelector, entityItem, false)
			if err != nil {
				return nil, err
			}
			if len(fromEntities) > 0 {
				result[rule.Reference] = append(result[rule.Reference], fromEntities...)
			}
		}
	}

	return result, nil
}

// findMatchingEntities is a helper function that finds entities matching a selector and property matchers
func (r *RelationshipRules) findMatchingEntities(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entityType string,
	entitySelector *oapi.Selector,
	sourceEntity any,
	evaluateFromTo bool, // true = evaluate(source, target), false = evaluate(target, source)
) ([]*relationships.Entity, error) {
	var result []*relationships.Entity

	switch entityType {
	case "deployment":
		for _, deployment := range r.store.Deployments.Items() {
			if entitySelector != nil {
				matched, err := selector.Match(ctx, entitySelector, deployment)
				if err != nil {
					return nil, err
				}
				if !matched {
					continue
				}
			}

			pm, err := rule.Matcher.AsPropertiesMatcher()
			if err != nil {
				return nil, err
			}
			// Apply property matchers if any
			if len(pm.Properties) > 0 {
				allMatch := true
				for _, pm := range pm.Properties {
					matcher := relationships.NewPropertyMatcher(&pm)
					var matches bool
					if evaluateFromTo {
						matches = matcher.Evaluate(sourceEntity, deployment)
					} else {
						matches = matcher.Evaluate(deployment, sourceEntity)
					}
					if !matches {
						allMatch = false
						break
					}
				}
				if !allMatch {
					continue
				}
			}

			result = append(result, relationships.NewDeploymentEntity(deployment))
		}
	case "environment":
		for _, environment := range r.store.Environments.Items() {
			if entitySelector != nil {
				matched, err := selector.Match(ctx, entitySelector, environment)
				if err != nil {
					return nil, err
				}
				if !matched {
					continue
				}
			}

			pm, err := rule.Matcher.AsPropertiesMatcher()
			if err != nil {
				return nil, err
			}
			// Apply property matchers if any
			if len(pm.Properties) > 0 {
				allMatch := true
				for _, pm := range pm.Properties {
					matcher := relationships.NewPropertyMatcher(&pm)
					var matches bool
					if evaluateFromTo {
						matches = matcher.Evaluate(sourceEntity, environment)
					} else {
						matches = matcher.Evaluate(environment, sourceEntity)
					}
					if !matches {
						allMatch = false
						break
					}
				}
				if !allMatch {
					continue
				}
			}

			result = append(result, relationships.NewEnvironmentEntity(environment))
		}
	case "resource":
		for _, resource := range r.store.Resources.Items() {
			if entitySelector != nil {
				matched, err := selector.Match(ctx, entitySelector, resource)
				if err != nil {
					return nil, err
				}
				if !matched {
					continue
				}
			}

			pm, err := rule.Matcher.AsPropertiesMatcher()
			if err != nil {
				return nil, err
			}
			// Apply property matchers if any
			if len(pm.Properties) > 0 {
				allMatch := true
				for _, pm := range pm.Properties {
					matcher := relationships.NewPropertyMatcher(&pm)
					var matches bool
					if evaluateFromTo {
						matches = matcher.Evaluate(sourceEntity, resource)
					} else {
						matches = matcher.Evaluate(resource, sourceEntity)
					}
					if !matches {
						allMatch = false
						break
					}
				}
				if !allMatch {
					continue
				}
			}

			result = append(result, relationships.NewResourceEntity(resource))
		}
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}

	return result, nil
}
