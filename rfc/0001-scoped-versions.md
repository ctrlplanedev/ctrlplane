# RFC 0001: Scoped Versions

**Status:** Draft
**Created:** 2026-03-13

## Summary

Add an optional `targetSelector` field to deployment versions that limits which
release targets a version flows through the promotion lifecycle for. This allows
deployers to express "this version only affects these targets" at creation time,
so unaffected targets skip the full policy pipeline entirely.

## Motivation

Ctrlplane already handles two kinds of changes differently:

- **Variable changes** roll out instantly. When a deployment variable or resource
  variable is updated, the affected release targets are re-reconciled with the
  new variable values. The version hasn't changed, so policies that already
  passed (approval, environment progression, verification) remain satisfied. The
  new release is created with updated variables and a job is dispatched
  immediately.

- **Version changes** go through the full promotion lifecycle. When a new
  deployment version is created with `status: ready`, ctrlplane creates releases
  for **every** release target in the deployment's matrix (Deployment x
  Environment x Resource). Each release goes through environment progression,
  approval gates, verification, gradual rollout, and cooldown before a job is
  created.

The problem is that many version changes only affect a subset of release targets.
A hotfix for a single region, a config embedded in the version for one service
variant, a change to a Helm chart that only impacts certain clusters — all of
these trigger the full promotion lifecycle across **all** targets.

This creates unnecessary latency. A deployer who knows their change only impacts
3 out of 50 clusters must still wait for staging verification, production
approval, and gradual rollout to complete across all 50. Unlike variable changes,
there is no way to express "this version change is narrow" — every version is
treated as a full rollout.

### Why ctrlplane cannot derive version impact automatically

For variable changes, ctrlplane can detect impact mechanically: it resolves the
new variable values, compares them to the current release's variables, and only
creates new releases where the resolved values actually differ. This is why
variable changes can roll out instantly — ctrlplane knows exactly what changed.

Version changes are fundamentally different. A release is defined as
`Version + Environment + Resource + Resolved Variables`. When a new version is
created, the version component is always new — that is the entire reason the
release exists. Even if every resolved variable is identical across targets, the
version ID differs, so every release is "different" from ctrlplane's perspective.
You cannot diff away the version itself.

The knowledge of which targets are truly impacted by a version change comes from
the deployer's understanding of what the change _means_ — which config files
changed in the Helm chart, which services are affected by the new image, which
regions need the update. This is semantic knowledge about the change that exists
outside ctrlplane's data model. Ctrlplane sees a new version and treats it as a
new version for all targets; it cannot know that "this Helm chart change only
affects the payment service" or "this image bump doesn't change behavior for
clusters running the old schema."

Scoped versions acknowledge this reality by giving the deployer a structured way
to express their knowledge, rather than trying to derive it mechanically. The
same way ctrlplane already trusts that variable selectors correctly express which
targets a variable value applies to, scoped versions let the deployer express
which targets a version applies to.

### Comparison with existing mechanisms

**Version Selectors** are policy rules that answer "is this version _allowed_ to
deploy to this target?" They are eligibility gates — a version that fails a
selector shows as **blocked/denied** in the UI and in rule evaluations. This is
semantically wrong for the scoped version use case: the version is not _bad_ for
unaffected targets, it is simply _irrelevant_. Version selectors also don't
exempt matching targets from other policy rules — a version that passes the
selector still goes through the full promotion chain.

**Policy Skips** allow bypassing individual policy rules for a version +
environment. They work today, but require the deployer to know specific rule IDs,
create skips per-rule per-environment, and the version still appears in the
evaluation pipeline for every target. They are an escape hatch, not a
first-class workflow.

**Scoped Versions** operate _before_ the policy pipeline. The reconciler skips
the version entirely for non-matching targets — no releases created, no policy
evaluations run, no "denied" entries in the UI. The intent ("this version is for
these targets") lives on the version itself, making it auditable and declarative.

## Proposal

### Schema

Add an optional `target_selector` column to the `deployment_version` table:

```sql
ALTER TABLE deployment_version
  ADD COLUMN target_selector TEXT;
```

When `NULL`, the version targets all release targets (current behavior). When
set, it contains a CEL expression evaluated against the release target's
resource, environment, and deployment.

### API

Extend the version creation endpoints to accept the new field.

**REST API:**

```
POST /v1/deployments/{deploymentId}/versions
```

```json
{
  "tag": "v1.2.3-hotfix",
  "status": "ready",
  "targetSelector": "resource.metadata['region'] == 'us-east-1'",
  "metadata": {
    "commit": "abc123",
    "scope": "us-east-1 payment hotfix"
  }
}
```

**Terraform:**

```hcl
resource "ctrlplane_deployment_version" "hotfix" {
  deployment_id   = ctrlplane_deployment.api.id
  tag             = "v1.2.3-hotfix"
  status          = "ready"
  target_selector = "resource.metadata['region'] == 'us-east-1'"
}
```

The CEL expression has access to the same variables as version selectors:
`resource`, `environment`, and `deployment`.

### Reconciler changes

In the desired release reconciler, the `findDeployableVersion` function
iterates candidate versions newest-first and evaluates policy rules. The target
selector check should be inserted **before** policy evaluation, as a pre-filter
on the candidate version list:

```
loadInput
  → getCandidateVersions
  → filterByTargetSelector   ← NEW: remove versions whose targetSelector
  → findDeployableVersion       does not match this release target
  → resolveVariables
  → persistRelease
```

Concretely, in `reconcile.go`, after `GetCandidateVersions` returns, filter the
list:

```go
func (r *reconciler) filterByTargetSelector(ctx context.Context) error {
    if len(r.versions) == 0 {
        return nil
    }

    filtered := make([]*oapi.DeploymentVersion, 0, len(r.versions))
    for _, v := range r.versions {
        if v.TargetSelector == "" {
            filtered = append(filtered, v)
            continue
        }
        matches, err := selector.MatchCEL(ctx, v.TargetSelector, r.scope)
        if err != nil {
            log.Warn("target selector eval failed, including version",
                "version", v.Id, "error", err)
            filtered = append(filtered, v)
            continue
        }
        if matches {
            filtered = append(filtered, v)
        }
    }
    r.versions = filtered
    return nil
}
```

Versions with a `targetSelector` that does not match the current release target
are silently removed from the candidate list. The reconciler then proceeds as
normal with the remaining candidates. If no candidates remain, the release
target keeps its current state.

### UI

The web UI should surface scoped versions in a few places:

1. **Version list** — Show a badge or indicator when a version has a
   `targetSelector`, with the expression visible on hover.
2. **Release target view** — When a version is scoped and doesn't match a
   target, it should not appear in that target's version evaluation list at all
   (as opposed to appearing as "denied").
3. **Version creation** — Optionally expose the `targetSelector` field in
   the UI when creating versions manually.

### Behavior with other policy rules

Scoped versions interact cleanly with existing policy rules:

- **Environment progression:** Only evaluated for targets that match the scope.
  If a scoped version targets production directly and no staging targets match,
  the environment progression rule is only evaluated for production targets. The
  deployer is responsible for ensuring this makes sense — the scope is an
  explicit declaration of intent.
- **Approval:** Approvals are per-environment. Only environments with matching
  targets will require approval.
- **Gradual rollout:** Rollout only applies across matching targets, naturally
  reducing the rollout surface.
- **Version cooldown:** Evaluated per-target as before, but only for targets in
  scope.

### Fallback behavior

If `targetSelector` evaluation fails (malformed CEL, missing fields), the
version should be **included** in the candidate list (fail-open). This prevents
a typo in a selector from silently dropping a version for all targets. The
failure should be logged as a warning.

## Examples

### Hotfix for a single region

```bash
curl -X POST ".../deployments/{id}/versions" \
  -d '{
    "tag": "v1.2.3-hotfix-use1",
    "status": "ready",
    "targetSelector": "resource.metadata[\"region\"] == \"us-east-1\""
  }'
```

Only us-east-1 release targets enter the promotion pipeline. All other targets
remain on their current version undisturbed.

### Config change for a specific environment

```bash
curl -X POST ".../deployments/{id}/versions" \
  -d '{
    "tag": "v2.0.1-staging-config",
    "status": "ready",
    "targetSelector": "environment.name == \"staging\""
  }'
```

Only staging targets are considered. This version never reaches production
targets, so no environment progression or production approval is triggered.

### Broad rollout (default behavior)

```bash
curl -X POST ".../deployments/{id}/versions" \
  -d '{
    "tag": "v2.1.0",
    "status": "ready"
  }'
```

No `targetSelector` — all release targets are considered. Identical to current
behavior.

## Migration

- The schema change is additive (`ADD COLUMN ... NULL`), requiring no data
  migration.
- Existing versions have `target_selector = NULL`, preserving current behavior.
- No changes to existing policies or release targets are needed.
- The reconciler change is backwards-compatible: versions without a selector pass
  through the filter unchanged.

## Open Questions

1. **Should scoped versions interact with environment progression?** If a version
   scopes to production only, should environment progression rules block it
   (staging hasn't seen it) or should the scope be treated as an explicit
   override of progression? The current proposal lets the deployer handle this —
   they can combine the scope with policy skips if needed.

2. **Should there be a permission or policy guard on scoping?** Scoped versions
   let deployers bypass the normal promotion surface area. Organizations may want
   to restrict who can create scoped versions, or require that scoped versions
   still pass through certain gates.

3. **Should the selector support resource-only, or also environment and
   deployment fields?** The proposal includes all three for flexibility, but
   simpler scoping (resource-only) might be sufficient and easier to reason
   about.

4. **Naming:** `targetSelector` vs `scope` vs `affectedTargets` — what conveys
   the intent most clearly?
