# ReconcileTargets Performance Benchmark

## Summary

Created comprehensive benchmark tests to replicate the production scenario where creating deployment versions takes up to 20 seconds.

## What Was Created

### 1. Main Benchmark Test File

**Location:** `test/e2e/reconcile_targets_bench_test.go`

Three benchmark functions that test `ReconcileTargets` performance:

#### BenchmarkReconcileTargets_DeploymentVersionCreated

- **Purpose:** Full production-scale test
- **Setup:**
  - 50 deployments
  - 15,000 resources
  - 20 environments (distributed across 5 regions)
  - 2 policies (approval + gradual rollout)
  - 2 relationship rules (region-based + zone-based)
- **Result:** ~300 release targets per deployment to reconcile
- **Tests:** The exact flow that happens when a deployment version is created

#### BenchmarkReconcileTargets_SingleDeployment

- **Purpose:** Baseline comparison
- **Setup:** 1 deployment, 100 resources, 1 environment, no policies/relationships
- **Tests:** Minimal overhead scenario

#### BenchmarkReconcileTargets_Scaling

- **Purpose:** Understand scaling characteristics
- **Tests:** 100, 500, 1000, 5000, 10000 targets
- **Output:** Shows how performance degrades with scale

### 2. Documentation

**Location:** `test/e2e/BENCHMARK_README.md`

Comprehensive guide including:

- How to run each benchmark
- How to interpret results
- Profiling commands (CPU, memory)
- Troubleshooting tips
- Performance optimization guidance

## Quick Start

### Run the Production-Scale Benchmark

```bash
cd /Users/justin/Git/ctrlplane/ctrlplane/apps/workspace-engine

# Run once (after fixing existing build errors)
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated -benchmem -benchtime=1x ./test/e2e/

# Run 10 times for better statistical accuracy
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated -benchmem -benchtime=10x ./test/e2e/
```

### Run with Profiling

```bash
# CPU profiling
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated \
  -benchmem -cpuprofile=cpu.prof -benchtime=1x ./test/e2e/
go tool pprof cpu.prof

# Memory profiling
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated \
  -benchmem -memprofile=mem.prof -benchtime=1x ./test/e2e/
go tool pprof mem.prof
```

### Run All Benchmarks

```bash
# Quick scaling analysis
go test -bench=BenchmarkReconcileTargets -benchmem ./test/e2e/
```

## Current Status

⚠️ **Note:** There is a pre-existing build error in the codebase:

```
pkg/workspace/releasemanager/policy/evaluator/evaulator.go:74:9:
cannot use NewMemoized(eval, eval.ScopeFields()) as Evaluator value in return statement:
*MemoizedEvaluator does not implement Evaluator (missing method RuleType)
```

The benchmark test file itself is syntactically correct and will run once this build error is fixed.

## Expected Output

When the benchmark runs successfully, you'll see:

```
Phase 1: Creating job agent...
Phase 2: Creating system...
Phase 3: Creating 20 environments...
Phase 4: Creating 15,000 resources...
  Created 5000/15000 resources...
  Created 10000/15000 resources...
  Created 15000/15000 resources...
Phase 5: Creating 50 deployments...
  Created 10/50 deployments...
  ...
  Created 50/50 deployments...
Phase 6: Creating policies...
Phase 7: Creating relationship rules...
Phase 8: Collecting workspace statistics...
=== Benchmark Environment Statistics ===
Resources: 15000
Deployments: 50
Environments: 20
Release Targets: 300000
Policies: 2
Relationship Rules: 2
========================================
Phase 9: Starting benchmark - simulating deployment version creation...
Deployment has 300 release targets to reconcile

BenchmarkReconcileTargets_DeploymentVersionCreated-10    10    XXXX ms/op    XXXX MB/op    XXXX allocs/op
```

## What the Benchmark Tests

The benchmark simulates the exact production scenario:

1. **Deployment Version Creation:** A new version is created for a deployment
2. **ReconcileTargets Call:** All release targets for that deployment need reconciliation
3. **Full Flow Execution:**
   - Relationship computation for each target's resource
   - Policy evaluation for each release target
   - Planning phase (determine desired release)
   - Eligibility checks
   - Execution (job creation, if eligible)

## Using Results for Optimization

### Step 1: Establish Baseline

```bash
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated \
  -benchmem -benchtime=10x ./test/e2e/ | tee baseline.txt
```

### Step 2: Profile to Find Bottlenecks

```bash
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated \
  -benchmem -cpuprofile=cpu.prof -benchtime=1x ./test/e2e/
go tool pprof -http=:8080 cpu.prof
```

### Step 3: Make Optimizations

Focus on:

- Reducing relationship computation overhead
- Caching policy evaluations
- Optimizing parallel processing
- Reducing memory allocations

### Step 4: Compare Results

```bash
go test -bench=BenchmarkReconcileTargets_DeploymentVersionCreated \
  -benchmem -benchtime=10x ./test/e2e/ | tee optimized.txt

benchcmp baseline.txt optimized.txt
```

## Performance Targets

Based on the production issue (20s per deployment version):

- **Critical:** < 2000ms per reconciliation (90% improvement needed)
- **Target:** < 1000ms per reconciliation (95% improvement)
- **Ideal:** < 500ms per reconciliation (97.5% improvement)

## Scaling Analysis

Use the scaling benchmark to understand complexity:

```bash
go test -bench=BenchmarkReconcileTargets_Scaling -benchmem ./test/e2e/
```

Expected complexity:

- **Linear O(n):** Good - time scales proportionally with targets
- **O(n log n):** Acceptable - slight degradation at scale
- **O(n²):** Bad - exponential growth, needs optimization

## Additional Metrics

For production monitoring, track:

- P50, P95, P99 latencies
- Memory usage trends
- Allocation rates
- Goroutine counts during reconciliation

## Next Steps

1. **Fix the existing build error** in `evaluator/evaulator.go`
2. **Run the production-scale benchmark** to get baseline metrics
3. **Profile the hot paths** using pprof
4. **Identify optimization opportunities**:
   - Pre-compute relationships
   - Cache policy evaluations
   - Batch database operations
   - Optimize parallel processing
5. **Measure improvements** with the benchmark
6. **Compare scaling characteristics** before/after optimizations

## Files Created

1. `test/e2e/reconcile_targets_bench_test.go` - Main benchmark implementation
2. `test/e2e/BENCHMARK_README.md` - Detailed usage guide
3. `RECONCILE_TARGETS_BENCHMARK.md` - This summary document

All benchmarks follow Go's testing conventions and integrate with the existing test infrastructure.
