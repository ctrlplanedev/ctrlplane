# Policy Rules Framework

A flexible, extensible framework for evaluating deployment policy rules in the workspace engine.

## Architecture

The framework is built around these core concepts:

### 1. **Evaluation Context** (`context.go`)

Contains all information needed to evaluate a rule:

- Deployment version being evaluated
- Release target (deployment + environment + resource)
- Related entities (deployment, environment, resource, policy)
- Current time (injectable for testing)
- Extensible metadata

### 2. **Rule Evaluator Interface** (`evaluator.go`)

All rule types implement this interface:

```go
type RuleEvaluator interface {
    Evaluate(ctx context.Context, evalCtx *EvaluationContext) (*EvaluationResult, error)
    Type() string
    RuleID() string
}
```

### 3. **Evaluation Results** (`result.go`)

Structured results with three possible outcomes:

- **Allowed**: Rule permits deployment
- **Denied**: Rule blocks deployment (permanent)
- **Pending**: Rule requires action (e.g., approval, wait for concurrency)

### 4. **Rule Registry** (`registry.go`)

Maps protobuf rule types to their evaluator implementations, enabling dynamic dispatch.

## Rule Types

### Currently Implemented

1. **Deny Window** (`deny_window.go`) - Prevents deployments during specified time windows
2. **User Approval** (`approval.go`) - Requires specific user approval
3. **Role Approval** (`approval.go`) - Requires approval from role member
4. **Any Approval** (`approval.go`) - Requires minimum number of approvals
5. **Concurrency** (`concurrency.go`) - Limits concurrent deployments
6. **Max Retries** (`retry.go`) - Limits retry attempts

### Coming Soon

- Environment Version Rollout - Controls progressive rollout
- Deployment Version Selector - Filters eligible versions
- Backout Window - Automatic rollback periods

## Usage

### Basic Evaluation

```go
// Create dependencies
deps := &RuleDependencies{
    ApprovalStore:   myApprovalStore,
    DeploymentStore: myDeploymentStore,
    RetryStore:      myRetryStore,
}

// Create registry with all standard rules
registry := NewDefaultRegistry(deps)

// Create policy evaluator
evaluator := NewPolicyEvaluator(registry)

// Create evaluation context
evalCtx := NewEvaluationContext(
    version,
    releaseTarget,
    deployment,
    environment,
    resource,
    policy,
)

// Evaluate all rules in the policy
result, err := evaluator.Evaluate(ctx, evalCtx)
if err != nil {
    // Handle error
}

// Check result
if result.Overall {
    // All rules passed - proceed with deployment
} else if result.HasPendingActions() {
    // Some rules require action (approval, wait)
    actions := result.GetPendingActions()
    // Handle pending actions
} else {
    // Deployment denied
    fmt.Println(result.Summary)
}
```

### Multi-Policy Evaluation

```go
// Create multi-policy evaluator
multiEvaluator := NewMultiPolicyEvaluator(evaluator, AllMustPass)

// Evaluate multiple policies
contexts := []*EvaluationContext{ctx1, ctx2, ctx3}
results, overallPass, err := multiEvaluator.Evaluate(ctx, contexts)
```

### Custom Rule Implementation

To add a new rule type:

1. Define the protobuf message in `workspace.proto`
2. Create an evaluator that implements `RuleEvaluator`
3. Register it in the registry:

```go
registry.Register("my_rule", func(rule interface{}) (RuleEvaluator, error) {
    pbRule := rule.(*pb.PolicyRule)
    myRule := pbRule.GetRule().(*pb.PolicyRule_MyRule).MyRule
    return NewMyRuleEvaluator(pbRule.Id, myRule, dependencies), nil
})
```

## Testing

The framework is designed for easy testing:

```go
// Use WithTime for time-dependent tests
evalCtx := NewEvaluationContext(...).WithTime(specificTime)

// Mock stores for unit testing
mockApprovalStore := &MockApprovalStore{...}
deps := &RuleDependencies{ApprovalStore: mockApprovalStore}

// Test individual rules
evaluator := NewDenyWindowEvaluator(ruleID, rule)
result, err := evaluator.Evaluate(ctx, evalCtx)
```

## Design Principles

1. **Separation of Concerns**: Rule evaluation logic is separate from storage
2. **Dependency Injection**: Stores are injected, making testing easy
3. **Immutability**: Evaluation contexts are immutable (use With\* methods)
4. **Composability**: Rules can be combined and evaluated independently
5. **Observability**: Detailed results with reasons and metadata
6. **Extensibility**: Easy to add new rule types without modifying existing code

## Store Interfaces

Rule evaluators depend on store interfaces:

- `ApprovalStore` - Query approval status
- `DeploymentStore` - Query active deployment counts
- `RetryStore` - Query retry history

Implement these interfaces in your storage layer to integrate with the rule framework.
