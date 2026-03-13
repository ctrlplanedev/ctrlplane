# RFC 0002: Plan-Based Diff Detection

**Status:** Draft
**Created:** 2026-03-13

## Summary

Add a `Plannable` interface to job agents that lets ctrlplane compute the
rendered deployment output for a release target _without_ dispatching a job.
By comparing the rendered output hash of a proposed version against the hash of
the currently deployed release, ctrlplane can mechanically determine which
release targets are actually affected by a version change. Unaffected targets
can then be fast-tracked through the promotion lifecycle.

## Motivation

RFC 0001 (Scoped Versions) introduces a way for deployers to _declare_ which
targets a version affects. This works well when the deployer knows the impact
upfront — a regional hotfix, a single-service config change. But it relies on
the deployer providing accurate scope. If the scope is wrong, targets are either
unnecessarily delayed (too broad) or silently skipped (too narrow).

The external systems ctrlplane dispatches to — ArgoCD, Terraform Cloud, Helm,
Kubernetes — already know how to compute what a deployment _would_ produce
without actually applying it. ArgoCD renders Application manifests from
templates. Terraform produces execution plans. Helm has `helm template`. These
systems can answer the question "would this version change anything for this
target?" with mechanical precision.

Today, ctrlplane cannot leverage this knowledge. The rendering happens inside
the job agent at dispatch time, and the result is never captured or compared.
ctrlplane treats every new version as a change for every target because it
operates on version identity (version ID differs → release differs), not on
rendered output identity (rendered manifest is the same → nothing changed).

### Why version identity is insufficient

A release's content hash (`Release.ContentHash()`) includes the version ID and
tag:

```go
func (r *Release) ContentHash() string {
    var sb strings.Builder
    sb.WriteString(r.Version.Id)
    sb.WriteString(r.Version.Tag)
    // ... variables and release target key
}
```

This means two releases with different versions _always_ have different content
hashes, even if the rendered deployment output is byte-for-byte identical. The
content hash answers "is this the same release?" but not "would this produce the
same deployed state?"

### Why rendering is the right level to compare

The rendered output is what actually gets applied to the target system. It is
the function of all inputs that matter:

```text
rendered_output = f(version.config, version.jobAgentConfig, resolvedVariables,
                    resource.config, deployment.config, template)
```

Two versions that produce identical rendered output for a target are
operationally equivalent for that target. No manifest changes, no Terraform
resource diffs, no Helm value differences — nothing would change if the job
ran. This is the same insight that `terraform plan` and `argocd app diff`
provide, brought into ctrlplane's promotion lifecycle.

### Relationship to RFC 0001

Scoped versions (RFC 0001) and plan-based diff detection are complementary:

- **Scoped versions** are fast and explicit — the deployer states intent, the
  reconciler filters instantly, no external calls needed.
- **Plan-based diffs** are accurate and automatic — the external system computes
  impact, no deployer knowledge required, but adds latency from the plan call.

A typical workflow might use scoped versions as the primary mechanism and
plan-based diffs as a validation step or as the basis for auto-generating the
scope.

## Proposal

### New interface: `Plannable`

Add an optional interface to the job agent type system alongside the existing
`Dispatchable` and `Verifiable`:

```go
// Plannable is optionally implemented by a Dispatchable to compute the
// rendered deployment output without dispatching a job. The reconciler
// uses this to detect whether a version change would produce a different
// deployed state for a given release target.
type Plannable interface {
    Plan(ctx context.Context, dispatchCtx *oapi.DispatchContext) (*PlanResult, error)
}

type PlanResult struct {
    // ContentHash is a deterministic hash of the rendered deployment output.
    // Two plans with the same ContentHash produce identical deployed state.
    ContentHash string

    // HasChanges indicates whether the rendered output differs from the
    // currently deployed state. When false, the target is unaffected.
    HasChanges bool

    // Diff is an optional human-readable summary of what changed. Stored
    // for audit and displayed in the UI. May be empty for no-diff results.
    Diff string
}
```

This follows the same pattern as `Verifiable`:

```go
// Existing pattern in types/types.go:
type Dispatchable interface {
    Type() string
    Dispatch(ctx context.Context, job *oapi.Job) error
}

type Verifiable interface {
    Verifications(config oapi.JobAgentConfig) ([]oapi.VerificationMetricSpec, error)
}

// New:
type Plannable interface {
    Plan(ctx context.Context, dispatchCtx *oapi.DispatchContext) (*PlanResult, error)
}
```

### Registry extension

The job agent registry already checks for optional interfaces. Add a `Plan`
method following the same pattern as `AgentVerifications`:

```go
func (r *Registry) Plan(
    ctx context.Context,
    agentType string,
    dispatchCtx *oapi.DispatchContext,
) (*types.PlanResult, error) {
    dispatcher, ok := r.dispatchers[agentType]
    if !ok {
        return nil, nil
    }

    p, ok := dispatcher.(types.Plannable)
    if !ok {
        return nil, nil
    }

    return p.Plan(ctx, dispatchCtx)
}
```

When an agent does not implement `Plannable`, the registry returns nil and the
reconciler falls back to treating the version as a change for all targets
(current behavior).

### Schema

Store the rendered content hash on the release target state so it can be
compared against future plan results:

```sql
ALTER TABLE release_target
  ADD COLUMN rendered_content_hash TEXT;
```

This column is updated when a job completes successfully. It represents the hash
of the output that was actually deployed.

Additionally, store plan results for audit and UI display:

```sql
CREATE TABLE release_target_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployment(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES deployment_version(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    has_changes BOOLEAN NOT NULL,
    diff TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Reconciler integration

The plan step fits into the desired release reconciler as an optional phase
between candidate selection and policy evaluation:

```text
loadInput
  → getCandidateVersions
  → filterByTargetSelector         (RFC 0001)
  → computePlanForTopCandidate     ← NEW
  → findDeployableVersion
  → resolveVariables
  → persistRelease
```

The plan is computed only for the top candidate version (newest first) to
minimize external calls. If the plan shows no changes, the reconciler can
either:

1. Skip the version for this target (move to the next candidate)
2. Fast-track the version through policy evaluation (auto-satisfy gates)

Which behavior applies depends on the policy configuration (see "Policy
integration" below).

```go
func (r *reconciler) computePlan(ctx context.Context) error {
    if len(r.versions) == 0 {
        return nil
    }

    version := r.versions[0]

    // Build a dispatch context for the candidate version
    dispatchCtx, err := r.buildDispatchContext(ctx, version)
    if err != nil {
        log.Warn("failed to build dispatch context for plan", "error", err)
        return nil // fail-open: proceed without plan
    }

    // Ask the job agent to compute the rendered output
    result, err := r.planner.Plan(ctx, r.agentType, dispatchCtx)
    if err != nil {
        log.Warn("plan failed", "error", err)
        return nil // fail-open
    }
    if result == nil {
        return nil // agent does not support planning
    }

    // Store the plan result
    r.planResult = result

    // Compare against the currently deployed hash
    if r.currentRenderedHash != "" && result.ContentHash == r.currentRenderedHash {
        result.HasChanges = false
    }

    return nil
}
```

### Policy integration

Plan results feed into the policy pipeline through a new optional policy rule
type: `diffCheck`. This rule evaluates the plan result and can auto-satisfy
other gates when no diff is detected:

```hcl
resource "ctrlplane_policy" "fast_track_no_diff" {
  name     = "Fast-track unchanged targets"
  selector = "environment.name == 'production'"

  diff_check {
    skip_when_no_diff = [
      "environment_progression",
      "approval",
      "verification",
    ]
  }
}
```

When the plan result for a release target shows `HasChanges = false`, the rules
listed in `skip_when_no_diff` are automatically satisfied. The version still
advances through the pipeline (the release is created, the release target state
updates), but blocking gates are bypassed.

If no `diffCheck` policy is configured, plan results are informational only —
stored for audit and displayed in the UI but not used to alter promotion flow.

The `diffCheck` evaluator would be added to the evaluator set in `policyeval.go`
alongside the existing evaluators:

```go
func RuleTypes() []string {
    return []string{
        (&versionselector.Evaluator{}).RuleType(),
        (&approval.AnyApprovalEvaluator{}).RuleType(),
        (&environmentprogression.EnvironmentProgressionEvaluator{}).RuleType(),
        (&gradualrollout.GradualRolloutEvaluator{}).RuleType(),
        (&deploymentdependency.DeploymentDependencyEvaluator{}).RuleType(),
        (&deploymentwindow.DeploymentWindowEvaluator{}).RuleType(),
        (&versioncooldown.VersionCooldownEvaluator{}).RuleType(),
        // NEW:
        (&diffcheck.DiffCheckEvaluator{}).RuleType(),
    }
}
```

### Agent implementations

#### ArgoCD

The ArgoCD agent already renders Application manifests in-process using Go
templates:

```go
func TemplateApplication(ctx *oapi.DispatchContext, tmpl string) (*v1alpha1.Application, error) {
    t, err := templatefuncs.Parse("argoCDAgentConfig", tmpl)
    // ...
    var buf bytes.Buffer
    if err := t.Execute(&buf, ctx.Map()); err != nil { ... }
    // ...
}
```

The `Plan` implementation renders the template and hashes the output:

```go
func (a *ArgoApplication) Plan(
    ctx context.Context,
    dispatchCtx *oapi.DispatchContext,
) (*types.PlanResult, error) {
    _, _, template, err := ParseJobAgentConfig(dispatchCtx.JobAgentConfig)
    if err != nil {
        return nil, err
    }

    app, err := TemplateApplication(dispatchCtx, template)
    if err != nil {
        return nil, err
    }

    MakeApplicationK8sCompatible(app)

    rendered, err := yaml.Marshal(app)
    if err != nil {
        return nil, err
    }

    hash := sha256.Sum256(rendered)
    return &types.PlanResult{
        ContentHash: hex.EncodeToString(hash[:]),
        HasChanges:  true, // caller compares against stored hash
    }, nil
}
```

This is fast — no network calls, pure in-process rendering. The same template
execution that happens at dispatch time is reused at plan time.

#### Terraform Cloud

Terraform Cloud has native plan support. The `Plan` implementation would trigger
a speculative plan run via the API and return the plan's resource change
summary:

```go
func (t *TerraformCloud) Plan(
    ctx context.Context,
    dispatchCtx *oapi.DispatchContext,
) (*types.PlanResult, error) {
    // Trigger a speculative plan (does not apply)
    run, err := t.client.CreateRun(ctx, RunConfig{
        IsDestroy:   false,
        PlanOnly:    true,
        Variables:   dispatchCtx.Variables,
    })
    if err != nil {
        return nil, err
    }

    // Wait for plan to complete
    plan, err := t.client.WaitForPlan(ctx, run.ID)
    if err != nil {
        return nil, err
    }

    hasChanges := plan.ResourceAdditions > 0 ||
        plan.ResourceChanges > 0 ||
        plan.ResourceDestructions > 0

    return &types.PlanResult{
        ContentHash: plan.StateHash,
        HasChanges:  hasChanges,
        Diff:        plan.Summary,
    }, nil
}
```

This involves a network call and takes longer (seconds to minutes). The
reconciler should handle this asynchronously.

#### GitHub Actions

GitHub Actions does not have a native plan/dry-run concept. The agent would not
implement `Plannable`, and the registry returns nil. Targets using GitHub Actions
fall back to current behavior — every version is treated as a change.

### Storing the deployed hash

When a job completes successfully, the reconciler updates the release target's
`rendered_content_hash`:

```go
func (s *Setter) UpdateRenderedHash(
    ctx context.Context,
    rt *ReleaseTarget,
    hash string,
) error {
    q := db.GetQueries(ctx)
    return q.UpdateReleaseTargetRenderedHash(ctx, db.UpdateReleaseTargetRenderedHashParams{
        ResourceID:          rt.ResourceID,
        EnvironmentID:       rt.EnvironmentID,
        DeploymentID:        rt.DeploymentID,
        RenderedContentHash: hash,
    })
}
```

For the initial deployment (no previous hash), `HasChanges` defaults to true.

### UI

1. **Release target view** — When a plan result exists, show a "No changes
   detected" or "Changes detected" indicator alongside the version evaluation.
   For targets with no changes, display a muted state to signal the version
   is advancing without operational impact.
2. **Diff viewer** — When `Diff` is populated, provide an expandable panel
   showing the human-readable diff (YAML diff for ArgoCD, resource summary for
   Terraform).
3. **Version detail** — Aggregate plan results across all release targets to
   show "X of Y targets affected" on the version page.

### Async plan execution

For agents where planning involves network calls (Terraform Cloud, external Helm
renderers), the plan should run asynchronously:

1. The reconciler enqueues a plan request when it encounters a new candidate
   version.
2. A plan worker processes the request, calls the agent's `Plan` method, and
   stores the result.
3. On the next reconciliation pass, the stored plan result is available and the
   reconciler uses it to determine diff status.

For agents where planning is in-process (ArgoCD template rendering), the plan
can run synchronously within the reconciler.

## Examples

### ArgoCD: Helm chart change affecting one service

A deployment manages 20 clusters across 4 environments. A new version updates
Helm values for the payment service. The ArgoCD template references
`{{ .release.variables.PAYMENT_IMAGE }}` only for clusters that run the payment
service.

1. Version `v3.1.0` is created with updated `config.paymentImage`.
2. The reconciler computes a plan for each release target by rendering the
   ArgoCD Application template.
3. For the 4 clusters running the payment service, the rendered manifest
   differs from the stored hash — `HasChanges = true`.
4. For the 16 other clusters, the rendered manifest is identical —
   `HasChanges = false`.
5. The `diffCheck` policy auto-satisfies environment progression and approval
   for the 16 unaffected clusters.
6. The 4 affected clusters go through the full promotion lifecycle.

### Terraform Cloud: Infrastructure change scoped to one region

A Terraform deployment manages infrastructure in 3 regions. A version changes
an IAM policy that only applies to us-east-1.

1. Version `v1.5.0` is created.
2. The reconciler triggers speculative plans for each region's release target.
3. The us-east-1 plan shows 1 resource change. The other two plans show 0
   changes.
4. Only the us-east-1 target enters the full promotion pipeline.

### GitHub Actions: No plan support (fallback)

A deployment uses GitHub Actions as its job agent. GitHub Actions does not
implement `Plannable`.

1. Version `v2.0.0` is created.
2. The reconciler calls `registry.Plan()` — returns nil.
3. All release targets enter the promotion pipeline as usual.
4. No change from current behavior.

## Migration

- The `rendered_content_hash` column is additive and nullable. Existing release
  targets start with `NULL`, meaning the first plan comparison always treats the
  target as changed (fail-open).
- The `release_target_plan` table is new and requires no data migration.
- Agents that do not implement `Plannable` continue to work without changes.
- The `diffCheck` policy rule is optional. Without it, plan results are
  informational only.

## Open Questions

1. **Should plan results block or only fast-track?** The current proposal only
   uses plan results to _skip_ policy gates (fast-track). An alternative is to
   _block_ versions that show no changes from creating releases at all, similar
   to how scoped versions filter candidates. The risk is that a plan bug could
   prevent legitimate deployments.

2. **How to handle plan staleness?** A plan result is a point-in-time snapshot.
   If a resource's config changes between the plan and the actual dispatch, the
   plan may be stale. Should plans have a TTL? Should the reconciler re-plan
   periodically?

3. **Cost of Terraform Cloud speculative plans.** Each plan consumes Terraform
   Cloud resources. For deployments with many release targets, the plan step
   could generate significant API load. Should planning be opt-in per
   deployment, or rate-limited?

4. **Should the plan run before or after variable resolution?** The current
   proposal runs the plan after variable resolution (since the dispatch context
   needs resolved variables). This means the plan captures variable changes too,
   which is correct but means the plan step depends on the variable resolver.

5. **Interaction with RFC 0001.** If a version has a `targetSelector` (RFC 0001)
   that excludes a target, should the plan still run for that target? The
   proposed order (filter by target selector, then plan) means excluded targets
   are never planned, which is efficient but means you cannot use plan results
   to validate a target selector's correctness.
