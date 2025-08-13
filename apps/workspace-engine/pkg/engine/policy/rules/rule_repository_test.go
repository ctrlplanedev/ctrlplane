package rules_test

import (
	"context"
	"testing"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	"workspace-engine/pkg/model/deployment"

	"gotest.tools/assert"
)

// MockRule implements the Rule interface for testing purposes
type MockRule struct {
	ID        string
	PolicyID  string
	CreatedAt time.Time
}

func (r *MockRule) GetID() string {
	return r.ID
}

func (r *MockRule) GetPolicyID() string {
	return r.PolicyID
}

func (r *MockRule) Evaluate(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*rules.RuleEvaluationResult, error) {
	// Mock implementation - always allow
	return &rules.RuleEvaluationResult{
		RuleID:      r.ID,
		Decision:    rules.PolicyDecisionAllow,
		Message:     "Mock rule always allows",
		EvaluatedAt: time.Now(),
		Conditions:  []rules.ConditionResult{},
		Warnings:    []string{},
	}, nil
}

type RuleRepositoryTestStep struct {
	createRule *MockRule
	removeRule *MockRule
	updateRule *MockRule

	expectedRules          []*MockRule
	expectedRulesForPolicy map[string][]*MockRule
	expectedExists         map[string]bool
}

type RuleRepositoryTest struct {
	name  string
	steps []RuleRepositoryTestStep
}

func TestRuleRepository(t *testing.T) {
	createRule := RuleRepositoryTest{
		name: "should create rule",
		steps: []RuleRepositoryTestStep{
			{
				createRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
		},
	}

	removeRule := RuleRepositoryTest{
		name: "should remove rule",
		steps: []RuleRepositoryTestStep{
			{
				createRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
			{
				removeRule: &MockRule{
					ID: "1",
				},
				expectedRules: []*MockRule{},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {},
				},
				expectedExists: map[string]bool{
					"1": false,
				},
			},
		},
	}

	updateRule := RuleRepositoryTest{
		name: "should update rule",
		steps: []RuleRepositoryTestStep{
			{
				createRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
			{
				updateRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
		},
	}

	multipleRules := RuleRepositoryTest{
		name: "should handle multiple rules",
		steps: []RuleRepositoryTestStep{
			{
				createRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
			{
				createRule: &MockRule{
					ID:        "2",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
					{
						ID:        "2",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
						{
							ID:        "2",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
					"2": true,
				},
			},
		},
	}

	multiplePolicies := RuleRepositoryTest{
		name: "should handle multiple policies",
		steps: []RuleRepositoryTestStep{
			{
				createRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
					"policy2": {},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
			{
				createRule: &MockRule{
					ID:        "2",
					PolicyID:  "policy2",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
					{
						ID:        "2",
						PolicyID:  "policy2",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
					"policy2": {
						{
							ID:        "2",
							PolicyID:  "policy2",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 1, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
					"2": true,
				},
			},
		},
	}

	createNilRule := RuleRepositoryTest{
		name: "should handle nil rule creation",
		steps: []RuleRepositoryTestStep{
			{
				createRule:             nil,
				expectedRules:          []*MockRule{},
				expectedRulesForPolicy: map[string][]*MockRule{},
				expectedExists:         map[string]bool{},
			},
		},
	}

	updateNilRule := RuleRepositoryTest{
		name: "should handle nil rule update",
		steps: []RuleRepositoryTestStep{
			{
				createRule: &MockRule{
					ID:        "1",
					PolicyID:  "policy1",
					CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
				},
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
			{
				updateRule: nil,
				expectedRules: []*MockRule{
					{
						ID:        "1",
						PolicyID:  "policy1",
						CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
					},
				},
				expectedRulesForPolicy: map[string][]*MockRule{
					"policy1": {
						{
							ID:        "1",
							PolicyID:  "policy1",
							CreatedAt: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
						},
					},
				},
				expectedExists: map[string]bool{
					"1": true,
				},
			},
		},
	}

	tests := []RuleRepositoryTest{
		createRule,
		removeRule,
		updateRule,
		multipleRules,
		multiplePolicies,
		createNilRule,
		updateNilRule,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			registry := rules.NewRuleRepository()
			ctx := context.Background()

			for _, step := range test.steps {
				if step.createRule != nil {
					// Convert MockRule to Rule interface
					var rule rules.Rule = step.createRule
					err := registry.Create(ctx, &rule)
					if step.createRule == nil {
						assert.ErrorContains(t, err, "rule is nil")
					} else {
						assert.NilError(t, err)
					}
				}

				if step.removeRule != nil {
					err := registry.Delete(ctx, step.removeRule.ID)
					assert.NilError(t, err)
				}

				if step.updateRule != nil {
					// Convert MockRule to Rule interface
					var rule rules.Rule = step.updateRule
					err := registry.Update(ctx, &rule)
					if step.updateRule == nil {
						assert.ErrorContains(t, err, "rule is nil")
					} else {
						assert.NilError(t, err)
					}
				}

				// Test GetAll
				allRules := registry.GetAll(ctx)
				assert.Equal(t, len(step.expectedRules), len(allRules))

				// Test GetAllForPolicy for each expected policy
				for policyID, expectedRules := range step.expectedRulesForPolicy {
					actualRules := registry.GetAllForPolicy(ctx, policyID)
					assert.Equal(t, len(expectedRules), len(actualRules))
				}

				// Test Exists for each expected rule
				for ruleID, expectedExists := range step.expectedExists {
					actualExists := registry.Exists(ctx, ruleID)
					assert.Equal(t, expectedExists, actualExists)
				}

				// Test Get for each expected rule
				for _, expectedRule := range step.expectedRules {
					if expectedRule != nil {
						actualRule := registry.Get(ctx, expectedRule.ID)
						assert.Assert(t, actualRule != nil)
						assert.Equal(t, expectedRule.GetID(), (*actualRule).GetID())
						assert.Equal(t, expectedRule.GetPolicyID(), (*actualRule).GetPolicyID())
					}
				}
			}
		})
	}
}
