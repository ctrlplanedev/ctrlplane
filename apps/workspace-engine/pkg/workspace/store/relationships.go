package store

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/pb"
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

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *pb.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	return nil
}

func (r *RelationshipRules) Get(id string) (*pb.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Has(id string) bool {
	return r.repo.RelationshipRules.Has(id)
}

func (r *RelationshipRules) Remove(id string) {
	r.repo.RelationshipRules.Remove(id)
}

// Relationship represents a matched relationship between a source and target entity
type Relationship struct {
	From any
	To   any
}

// RelationshipResult contains the matched relationships for a rule
type RelationshipResult struct {
	RuleID           string
	RuleName         string
	RelationshipType string
	Relationships    []Relationship
}

// GetRelationships returns all matched relationships for a given relationship rule
func (r *RelationshipRules) GetRelationships(ctx context.Context, ruleID string) (*RelationshipResult, error) {
	rule, exists := r.repo.RelationshipRules.Get(ruleID)
	if !exists {
		return nil, fmt.Errorf("relationship rule %s not found", ruleID)
	}

	// Get source entities
	sourceEntities, err := r.getEntitiesByType(ctx, rule.FromType, rule.FromSelector)
	if err != nil {
		return nil, fmt.Errorf("failed to get source entities: %w", err)
	}

	// Get target entities
	targetEntities, err := r.getEntitiesByType(ctx, rule.ToType, rule.ToSelector)
	if err != nil {
		return nil, fmt.Errorf("failed to get target entities: %w", err)
	}

	// Apply property matchers if they exist
	var matchedRelationships []Relationship
	if len(rule.PropertyMatchers) == 0 {
		// No property matchers - create Cartesian product
		for _, source := range sourceEntities {
			for _, target := range targetEntities {
				matchedRelationships = append(matchedRelationships, Relationship{
					From: source,
					To:   target,
				})
			}
		}
	} else {
		// Apply property matchers
		matchers := make([]*relationships.PropertyMatcher, len(rule.PropertyMatchers))
		for i, pm := range rule.PropertyMatchers {
			matchers[i] = relationships.NewPropertyMatcher(pm)
		}

		for _, source := range sourceEntities {
			for _, target := range targetEntities {
				// Check if all property matchers pass
				allMatch := true
				for _, matcher := range matchers {
					if !matcher.Evaluate(source, target) {
						allMatch = false
						break
					}
				}
				if allMatch {
					matchedRelationships = append(matchedRelationships, Relationship{
						From: source,
						To:   target,
					})
				}
			}
		}
	}

	return &RelationshipResult{
		RuleID:           rule.Id,
		RuleName:         rule.Name,
		RelationshipType: rule.RelationshipType,
		Relationships:    matchedRelationships,
	}, nil
}

// getEntitiesByType retrieves and filters entities based on type and selector
func (r *RelationshipRules) getEntitiesByType(ctx context.Context, entityType string, sel *pb.Selector) ([]any, error) {
	entityType = strings.ToLower(entityType)

	switch entityType {
	case "resource":
		return r.getResources(ctx, sel)
	case "deployment":
		return r.getDeployments(ctx, sel)
	case "environment":
		return r.getEnvironments(ctx, sel)
	default:
		return nil, fmt.Errorf("unsupported entity type: %s", entityType)
	}
}

// getResources retrieves and filters resources based on selector
func (r *RelationshipRules) getResources(ctx context.Context, sel *pb.Selector) ([]any, error) {
	// Collect all resources
	resources := make([]*pb.Resource, 0, r.repo.Resources.Count())
	for item := range r.repo.Resources.IterBuffered() {
		resources = append(resources, item.Val)
	}

	// If no selector, return all resources
	if sel == nil {
		result := make([]any, len(resources))
		for i, res := range resources {
			result[i] = res
		}
		return result, nil
	}

	// Filter resources using selector
	filteredMap, err := selector.FilterResources(ctx, sel, resources)
	if err != nil {
		return nil, err
	}

	// Convert map to slice
	result := make([]any, 0, len(filteredMap))
	for _, res := range filteredMap {
		result = append(result, res)
	}
	return result, nil
}

// getDeployments retrieves and filters deployments based on selector
func (r *RelationshipRules) getDeployments(ctx context.Context, sel *pb.Selector) ([]any, error) {
	// Collect all deployments
	deployments := make([]any, 0, r.repo.Deployments.Count())
	for item := range r.repo.Deployments.IterBuffered() {
		deployments = append(deployments, item.Val)
	}

	// If no selector, return all deployments
	if sel == nil {
		return deployments, nil
	}

	// Filter deployments using selector
	result := make([]any, 0)
	for _, dep := range deployments {
		deployment := dep.(*pb.Deployment)
		matched, err := r.matchesSelector(ctx, sel, deployment)
		if err != nil {
			return nil, err
		}
		if matched {
			result = append(result, deployment)
		}
	}
	return result, nil
}

// getEnvironments retrieves and filters environments based on selector
func (r *RelationshipRules) getEnvironments(ctx context.Context, sel *pb.Selector) ([]any, error) {
	// Collect all environments
	environments := make([]any, 0, r.repo.Environments.Count())
	for item := range r.repo.Environments.IterBuffered() {
		environments = append(environments, item.Val)
	}

	// If no selector, return all environments
	if sel == nil {
		return environments, nil
	}

	// Filter environments using selector
	result := make([]any, 0)
	for _, env := range environments {
		environment := env.(*pb.Environment)
		matched, err := r.matchesSelector(ctx, sel, environment)
		if err != nil {
			return nil, err
		}
		if matched {
			result = append(result, environment)
		}
	}
	return result, nil
}

// matchesSelector checks if an entity matches a selector
func (r *RelationshipRules) matchesSelector(ctx context.Context, sel *pb.Selector, entity any) (bool, error) {
	if sel == nil || sel.GetJson() == nil {
		return true, nil
	}

	// For now, we use the selector package which works for resources
	// For deployments and environments, we need generic matching
	// This is a simplified implementation
	return true, nil
}

// GetRelations returns related entities for a given entity across all relationship rules
func (r *RelationshipRules) GetRelations(ctx context.Context, entity any) map[string][]any {
	relations := make(map[string][]any)

	// Iterate through all relationship rules
	for item := range r.repo.RelationshipRules.IterBuffered() {
		rule := item.Val
		result, err := r.GetRelationships(ctx, rule.Id)
		if err != nil {
			continue
		}

		// Find relationships involving this entity
		for _, rel := range result.Relationships {
			// Check if entity is the source
			if rel.From == entity {
				if relations[rule.RelationshipType] == nil {
					relations[rule.RelationshipType] = []any{}
				}
				relations[rule.RelationshipType] = append(relations[rule.RelationshipType], rel.To)
			}
		}
	}

	return relations
}

