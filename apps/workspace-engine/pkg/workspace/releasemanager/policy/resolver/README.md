# Policy Resolver

The Policy Resolver is a helper utility for fetching and filtering policy rules for a given release target. It simplifies the process of extracting specific rule types from policies while handling:

- Policy fetching based on release target selectors
- Filtering by enabled/disabled policies
- Extracting specific rule types from policy rules
- Providing rich metadata about rules and their parent policies
- Tracing and observability

## Usage

### Basic Example

```go
import (
    "workspace-engine/pkg/workspace/releasemanager/policy/resolver"
)

// Get retry rules for a release target
retryRules, err := resolver.GetRules(
    ctx,
    store,
    releaseTarget,
    resolver.RetryRuleExtractor,
    span, // optional span for tracing
)
if err != nil {
    return err
}

// Use the extracted rules
for _, ruleWithPolicy := range retryRules {
    rule := ruleWithPolicy.Rule          // *oapi.RetryRule
    policyName := ruleWithPolicy.PolicyName
    ruleId := ruleWithPolicy.RuleId
    priority := ruleWithPolicy.Priority

    // Create evaluator or perform logic with the rule
    evaluator := retry.NewEvaluator(store, rule)
}
```

### Built-in Rule Extractors

The package provides extractors for all standard rule types:

- `RetryRuleExtractor` - Extracts `RetryRule` from policies
- `AnyApprovalRuleExtractor` - Extracts `AnyApprovalRule` from policies
- `GradualRolloutRuleExtractor` - Extracts `GradualRolloutRule` from policies
- `EnvironmentProgressionRuleExtractor` - Extracts `EnvironmentProgressionRule` from policies

### Custom Rule Extractor

You can create custom extractors for any rule type:

```go
// Custom extractor function
func MyCustomRuleExtractor(rule *oapi.PolicyRule) *oapi.MyCustomRule {
    return rule.MyCustomRule
}

// Use it with GetRules
customRules, err := resolver.GetRules(
    ctx,
    store,
    releaseTarget,
    MyCustomRuleExtractor,
    nil,
)
```

## RuleWithPolicy Structure

Each extracted rule is wrapped in a `RuleWithPolicy[T]` struct that provides:

```go
type RuleWithPolicy[T any] struct {
    Rule       *T      // The extracted rule (e.g., *oapi.RetryRule)
    RuleId     string  // ID of the rule
    PolicyId   string  // ID of the parent policy
    PolicyName string  // Name of the parent policy
    Priority   int     // Priority of the parent policy
}
```

This metadata is useful for:

- Tracing and debugging
- Understanding which policy a rule came from
- Prioritizing rules when multiple policies apply
- Logging and auditing

## Integration Example

Here's how the policy resolver is used in `JobEligibilityChecker`:

```go
func (c *JobEligibilityChecker) buildRetryEvaluators(
    ctx context.Context,
    release *oapi.Release,
    span oteltrace.Span,
) []evaluator.JobEvaluator {
    // Use policy resolver to get retry rules
    retryRules, err := resolver.GetRules(
        ctx,
        c.store,
        &release.ReleaseTarget,
        resolver.RetryRuleExtractor,
        span,
    )
    if err != nil {
        // Handle error - use defaults
        return []evaluator.JobEvaluator{
            retry.NewEvaluator(c.store, nil),
        }
    }

    // Create evaluators from extracted rules
    evaluators := make([]evaluator.JobEvaluator, 0)
    for _, ruleWithPolicy := range retryRules {
        eval := retry.NewEvaluator(c.store, ruleWithPolicy.Rule)
        evaluators = append(evaluators, eval)
    }

    // Handle no rules case
    if len(retryRules) == 0 {
        evaluators = append(evaluators, retry.NewEvaluator(c.store, nil))
    }

    return evaluators
}
```

## Key Features

### 1. Only Enabled Policies

The resolver automatically filters out disabled policies, so you don't have to check `policy.Enabled` yourself.

### 2. Type-Safe Extraction

Using generics, the resolver provides type-safe rule extraction. The extractor function and return type are both typed to the specific rule type you're working with.

### 3. Tracing Integration

Pass an optional span to `GetRules` to automatically emit tracing events for:

- Policies fetched
- Rules extracted
- Policy metadata (name, ID, priority)

### 4. Nil Handling

If a rule of the requested type doesn't exist on a `PolicyRule`, the extractor returns `nil` and that rule is skipped.

## Testing

See `resolver_test.go` for comprehensive test examples covering:

- Single and multiple rules
- Multiple policies
- Disabled policies
- Different rule types
- No matching rules scenarios
