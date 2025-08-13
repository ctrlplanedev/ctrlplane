package rules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/model"
)

var _ model.Repository[Rule] = (*RuleRepository)(nil)

// RuleRepository provides a comprehensive interface for managing policy rules in persistent storage.
// It supports full CRUD operations as well as advanced querying capabilities for rule management.
// The generic Target type parameter ensures type safety when working with rules for specific target types.
type RuleRepository struct {
	rules map[string]*Rule
}

func NewRuleRepository() *RuleRepository {
	return &RuleRepository{
		rules: make(map[string]*Rule),
	}
}

// Create implements model.Repository.
func (r *RuleRepository) Create(ctx context.Context, entity *Rule) error {
	if entity == nil {
		return fmt.Errorf("rule is nil")
	}
	r.rules[(*entity).GetID()] = entity
	return nil
}

// Delete implements model.Repository.
func (r *RuleRepository) Delete(ctx context.Context, entityID string) error {
	delete(r.rules, entityID)
	return nil
}

// Exists implements model.Repository.
func (r *RuleRepository) Exists(ctx context.Context, entityID string) bool {
	_, ok := r.rules[entityID]
	return ok
}

// Get implements model.Repository.
func (r *RuleRepository) Get(ctx context.Context, entityID string) *Rule {
	return r.rules[entityID]
}

// GetAll implements model.Repository.
func (r *RuleRepository) GetAll(ctx context.Context) []*Rule {
	rules := make([]*Rule, 0, len(r.rules))
	for _, rule := range r.rules {
		rules = append(rules, rule)
	}
	return rules
}

// GetAllForPolicy returns all rules for a given policy ID
func (r *RuleRepository) GetAllForPolicy(ctx context.Context, policyID string) []*Rule {
	var rulePtrs []*Rule
	for _, rule := range r.rules {
		if (*rule).GetPolicyID() == policyID {
			rulePtrs = append(rulePtrs, rule)
		}
	}
	return rulePtrs
}

// Update implements model.Repository.
func (r *RuleRepository) Update(ctx context.Context, entity *Rule) error {
	if entity == nil {
		return fmt.Errorf("rule is nil")
	}
	r.rules[(*entity).GetID()] = entity
	return nil
}
