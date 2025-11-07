# Reconciliation Scheduler

The reconciliation scheduler is an in-memory optimization that tracks when release targets need to be reconciled next based on time-sensitive policies.

## Overview

Instead of reconciling all 2000+ release targets on every tick (expensive), the scheduler tracks which targets need evaluation at specific times, reducing the workload by 10-50x.

## What It Tracks

The scheduler determines next reconciliation times based on:

1. **Soak Time Policies** - When `MinimumSockTimeMinutes` expires
2. **Gradual Rollout** - When next target should be deployed 
3. **In-Progress Jobs** - Check back when job might complete
4. **New Targets** - Targets that have never been scheduled

## Usage

### Accessing the Scheduler

```go
scheduler := releaseManager.Scheduler()
```

### Scheduling a Target

```go
// After reconciliation, schedule when to check next
nextTime := time.Now().Add(30 * time.Minute)
scheduler.Schedule(releaseTarget, nextTime)
```

### Getting Due Targets (for Tick Handler)

```go
now := time.Now()
dueKeys := scheduler.GetDue(now)  // Returns keys of targets needing reconciliation

// Clear processed schedules
scheduler.Clear(dueKeys)
```

### Checking Schedule Size (for Bootstrap Detection)

```go
if scheduler.Size() == 0 {
    // First tick after reboot - do full reconciliation
}
```

### Using Pre-computed Relationships

The scheduler works with the relationship optimization:

```go
// Pre-compute relationships once for all unique resources
resourceRelationships := computeResourceRelationships(ctx, ws, releaseTargets)

// Use them during reconciliation
err := releaseManager.ReconcileTargetWithRelationships(
    ctx, 
    releaseTarget, 
    false, // forceRedeploy
    resourceRelationships[releaseTarget.ResourceId],
)
```

## Bootstrap Behavior

The scheduler is **in-memory only**. On restart/reboot:

1. Schedule is empty
2. First tick (within 5 minutes) detects empty schedule
3. Reconciles all targets once (with optimizations)
4. Rebuilds schedule for future ticks
5. Subsequent ticks are fast again

This is acceptable because:
- Max delay is 5 minutes (tick interval)
- Most time-sensitive policies are 10-30+ minutes
- Any event (new version, approval, etc.) triggers reconciliation immediately
- System self-heals automatically

## Performance Impact

**Without scheduler (current):**
- Tick processes 2000 targets
- 2000 × 50ms `GetRelatedEntities` calls = 100 seconds

**With scheduler:**
- Tick processes ~50-200 targets (only those scheduled)
- 200 × 50ms = 10 seconds (10x improvement)
- Plus relationship pre-computation reduces further

**Bootstrap tick (after reboot):**
- Processes all 2000 targets once
- But with relationship pre-computation: only ~200 unique resources
- 200 × 50ms = 10 seconds (still better than current!)

## How It Works

### Policy Evaluators Set Next Evaluation Time

Policy evaluators (soak time, gradual rollout, etc.) now set `NextEvaluationTime` on their `RuleEvaluation` results:

```go
// In SoakTimeEvaluator
if soakTimeRemaining > 0 {
    nextEvalTime := mostRecentSuccess.Add(soakDuration)
    return results.NewPendingResult(results.ActionTypeWait, message).
        WithNextEvaluationTime(nextEvalTime)
}

// In GradualRolloutEvaluator  
if now.Before(deploymentTime) {
    return results.NewPendingResult(results.ActionTypeWait, reason).
        WithNextEvaluationTime(deploymentTime)
}
```

### Scheduler Uses NextEvaluationTime

The scheduler simply looks at the `NextEvaluationTime` field:

```go
func ComputeNextReconciliationTime(
    releaseTarget *oapi.ReleaseTarget,
    desiredRelease *oapi.Release,
    latestJob *oapi.Job,
    policyResults []*oapi.RuleEvaluation,
) time.Time {
    var nextTime time.Time
    
    for _, result := range policyResults {
        if result.NextEvaluationTime != nil {
            evalTime := *result.NextEvaluationTime
            if nextTime.IsZero() || evalTime.Before(nextTime) {
                nextTime = evalTime
            }
        }
    }
    
    return nextTime
}
```

## Implementation Details

See:
- `reconciliation_scheduler.go` - Scheduler implementation
- `manager.go` - Integration with Manager
- `ComputeNextReconciliationTime()` - Logic to determine next check time
- `oapi/spec/schemas/policy.jsonnet` - RuleEvaluation schema with `nextEvaluationTime` field
- `policy/evaluator/environmentprogression/soaktime.go` - Sets next eval time for soak policies
- `policy/evaluator/gradualrollout/gradualrollout.go` - Sets next eval time for rollout policies

## Future Enhancements

1. **Metrics** - Expose scheduled count, hit rate, etc.
2. **Adaptive Intervals** - Tick more frequently when many targets are due soon
3. **Priority Queue** - More efficient "get due" at very large scale (10k+ targets)
4. **Persistence** - Optional for systems that reboot frequently and can't afford 5min delay

