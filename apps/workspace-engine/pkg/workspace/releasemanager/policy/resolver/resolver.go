package resolver

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/resolver")

// PolicyResolver helps fetch and filter policy rules for a given release target.
type PolicyResolver struct {
	store *store.Store
}

// NewPolicyResolver creates a new policy resolver.
func NewPolicyResolver(store *store.Store) *PolicyResolver {
	return &PolicyResolver{store: store}
}

// RuleExtractor is a function that extracts a specific rule type from a PolicyRule.
// It should return the rule if it exists, or nil if it doesn't.
type RuleExtractor[T any] func(*oapi.PolicyRule) *T

// RuleWithPolicy wraps a rule with its parent policy metadata.
type RuleWithPolicy[T any] struct {
	Rule       *T
	RuleId     string
	PolicyId   string
	PolicyName string
	Priority   int
}

// GetRules fetches applicable policies for a release target and extracts rules of a specific type.
// It only returns rules from enabled policies.
//
// Parameters:
//   - ctx: Context for tracing and cancellation
//   - store: The store to fetch policies from
//   - releaseTarget: The release target to find policies for
//   - extractor: Function to extract the desired rule type from a PolicyRule
//   - span: Optional span for tracing (can be nil)
//
// Returns:
//   - []RuleWithPolicy: Slice of extracted rules with their parent policy information
//   - error: Error if policy fetching fails
func GetRules[T any](
	ctx context.Context,
	store *store.Store,
	releaseTarget *oapi.ReleaseTarget,
	extractor RuleExtractor[T],
	span oteltrace.Span,
) ([]RuleWithPolicy[T], error) {
	ctx, resolverSpan := tracer.Start(ctx, "PolicyResolver.GetRules")
	defer resolverSpan.End()

	// Use provided span for events if available, otherwise use our own
	eventSpan := span
	if eventSpan == nil {
		eventSpan = resolverSpan
	}

	// Fetch applicable policies for this release target
	policies, err := store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		eventSpan.AddEvent("Failed to get policies",
			oteltrace.WithAttributes(attribute.String("error", err.Error())))
		return nil, err
	}

	eventSpan.SetAttributes(attribute.Int("policies.total", len(policies)))

	// Extract rules from policies
	rules := make([]RuleWithPolicy[T], 0)
	enabledPolicies := 0

	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}
		enabledPolicies++

		for _, rule := range policy.Rules {
			extractedRule := extractor(&rule)
			if extractedRule != nil {
				rules = append(rules, RuleWithPolicy[T]{
					Rule:       extractedRule,
					RuleId:     rule.Id,
					PolicyId:   policy.Id,
					PolicyName: policy.Name,
					Priority:   policy.Priority,
				})

				eventSpan.AddEvent("Found matching rule",
					oteltrace.WithAttributes(
						attribute.String("policy.id", policy.Id),
						attribute.String("policy.name", policy.Name),
						attribute.String("rule.id", rule.Id),
						attribute.Int("policy.priority", policy.Priority),
					))
			}
		}
	}

	eventSpan.SetAttributes(
		attribute.Int("policies.enabled", enabledPolicies),
		attribute.Int("rules.extracted", len(rules)),
	)

	return rules, nil
}

// Common rule extractors for built-in rule types

// RetryRuleExtractor extracts RetryRule from a PolicyRule.
func RetryRuleExtractor(rule *oapi.PolicyRule) *oapi.RetryRule {
	return rule.Retry
}

// AnyApprovalRuleExtractor extracts AnyApprovalRule from a PolicyRule.
func AnyApprovalRuleExtractor(rule *oapi.PolicyRule) *oapi.AnyApprovalRule {
	return rule.AnyApproval
}

// GradualRolloutRuleExtractor extracts GradualRolloutRule from a PolicyRule.
func GradualRolloutRuleExtractor(rule *oapi.PolicyRule) *oapi.GradualRolloutRule {
	return rule.GradualRollout
}

// EnvironmentProgressionRuleExtractor extracts EnvironmentProgressionRule from a PolicyRule.
func EnvironmentProgressionRuleExtractor(rule *oapi.PolicyRule) *oapi.EnvironmentProgressionRule {
	return rule.EnvironmentProgression
}
