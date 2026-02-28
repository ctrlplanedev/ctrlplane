package harness

import (
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"

	"github.com/google/uuid"
)

// PipelineOption configures the scenario for a TestPipeline.
type PipelineOption func(*ScenarioState)

// DeploymentOption configures the deployment within a scenario.
type DeploymentOption func(*ScenarioState)

// VersionOption configures a deployment version within a scenario.
type VersionOption func(*oapi.DeploymentVersion)

// ResourceOption configures a resource within a scenario.
type ResourceOption func(*ResourceDef)

// EnvironmentOption configures the environment within a scenario.
type EnvironmentOption func(*ScenarioState)

// PolicyOption configures a policy within a scenario.
type PolicyOption func(*oapi.Policy)

// PolicyRuleOption configures a rule within a policy.
type PolicyRuleOption func(*oapi.PolicyRule)

// ---------------------------------------------------------------------------
// Top-level pipeline options
// ---------------------------------------------------------------------------

// WithDeployment configures the deployment for the scenario.
func WithDeployment(opts ...DeploymentOption) PipelineOption {
	return func(sc *ScenarioState) {
		for _, o := range opts {
			o(sc)
		}
		sc.DeploymentRaw = map[string]any{
			"name":     sc.DeploymentName,
			"metadata": map[string]any{},
		}
	}
}

// WithVersion adds a candidate deployment version to the scenario.
func WithVersion(opts ...VersionOption) PipelineOption {
	return func(sc *ScenarioState) {
		v := &oapi.DeploymentVersion{
			Id:             uuid.New().String(),
			Tag:            fmt.Sprintf("v0.0.%d", len(sc.Versions)+1),
			Name:           fmt.Sprintf("version-%d", len(sc.Versions)+1),
			DeploymentId:   sc.DeploymentID.String(),
			Status:         oapi.DeploymentVersionStatusReady,
			CreatedAt:      time.Now(),
			Config:         map[string]any{},
			JobAgentConfig: map[string]any{},
			Metadata:       map[string]string{},
		}
		for _, o := range opts {
			o(v)
		}
		sc.Versions = append(sc.Versions, v)
	}
}

// WithResource adds a resource to the scenario.
func WithResource(opts ...ResourceOption) PipelineOption {
	return func(sc *ScenarioState) {
		rd := ResourceDef{
			ID:     uuid.New(),
			Name:   fmt.Sprintf("resource-%d", len(sc.Resources)+1),
			Kind:   "DefaultKind",
			Labels: map[string]any{},
		}
		for _, o := range opts {
			o(&rd)
		}
		sc.Resources = append(sc.Resources, rd)
	}
}

// WithEnvironment configures the environment for the scenario.
func WithEnvironment(opts ...EnvironmentOption) PipelineOption {
	return func(sc *ScenarioState) {
		for _, o := range opts {
			o(sc)
		}
	}
}

// WithPolicy adds a policy to the scenario.
func WithPolicy(opts ...PolicyOption) PipelineOption {
	return func(sc *ScenarioState) {
		p := &oapi.Policy{
			Id:          uuid.New().String(),
			Name:        fmt.Sprintf("policy-%d", len(sc.Policies)+1),
			Selector:    "true",
			Enabled:     true,
			Rules:       []oapi.PolicyRule{},
			Priority:    0,
			Metadata:    map[string]string{},
			WorkspaceId: sc.WorkspaceID.String(),
			CreatedAt:   time.Now().Format(time.RFC3339),
		}
		for _, o := range opts {
			o(p)
		}
		sc.Policies = append(sc.Policies, p)
	}
}

// ---------------------------------------------------------------------------
// Deployment options
// ---------------------------------------------------------------------------

// DeploymentSelector sets the CEL resource selector for the deployment.
func DeploymentSelector(cel string) DeploymentOption {
	return func(sc *ScenarioState) { sc.DeploymentSelector = cel }
}

// DeploymentName sets the deployment name.
func DeploymentName(name string) DeploymentOption {
	return func(sc *ScenarioState) { sc.DeploymentName = name }
}

// DeploymentID sets the deployment UUID.
func DeploymentID(id uuid.UUID) DeploymentOption {
	return func(sc *ScenarioState) { sc.DeploymentID = id }
}

// ---------------------------------------------------------------------------
// Version options
// ---------------------------------------------------------------------------

// VersionTag sets the tag on a deployment version.
func VersionTag(tag string) VersionOption {
	return func(v *oapi.DeploymentVersion) { v.Tag = tag }
}

// VersionID sets the ID on a deployment version.
func VersionID(id string) VersionOption {
	return func(v *oapi.DeploymentVersion) { v.Id = id }
}

// VersionName sets the name on a deployment version.
func VersionName(name string) VersionOption {
	return func(v *oapi.DeploymentVersion) { v.Name = name }
}

// VersionStatus sets the status on a deployment version.
func VersionStatus(status oapi.DeploymentVersionStatus) VersionOption {
	return func(v *oapi.DeploymentVersion) { v.Status = status }
}

// VersionMetadata sets the metadata on a deployment version.
func VersionMetadata(metadata map[string]string) VersionOption {
	return func(v *oapi.DeploymentVersion) { v.Metadata = metadata }
}

// ---------------------------------------------------------------------------
// Resource options
// ---------------------------------------------------------------------------

// ResourceName sets the name on a resource.
func ResourceName(name string) ResourceOption {
	return func(rd *ResourceDef) { rd.Name = name }
}

// ResourceKind sets the kind on a resource.
func ResourceKind(kind string) ResourceOption {
	return func(rd *ResourceDef) { rd.Kind = kind }
}

// ResourceLabels sets the metadata labels on a resource.
func ResourceLabels(labels map[string]any) ResourceOption {
	return func(rd *ResourceDef) { rd.Labels = labels }
}

// ResourceID sets the UUID on a resource.
func ResourceID(id uuid.UUID) ResourceOption {
	return func(rd *ResourceDef) { rd.ID = id }
}

// ResourceMetadata sets top-level metadata fields on a resource, accessible
// via resource.metadata["key"] in CEL selectors. This matches the metadata
// shape used in the e2e tests and production resource model.
func ResourceMetadata(metadata map[string]any) ResourceOption {
	return func(rd *ResourceDef) { rd.Metadata = metadata }
}

// ---------------------------------------------------------------------------
// Environment options
// ---------------------------------------------------------------------------

// EnvironmentName sets the name on the environment.
func EnvironmentName(name string) EnvironmentOption {
	return func(sc *ScenarioState) { sc.EnvironmentName = name }
}

// EnvironmentID sets the UUID of the environment.
func EnvironmentID(id uuid.UUID) EnvironmentOption {
	return func(sc *ScenarioState) { sc.EnvironmentID = id }
}

// ---------------------------------------------------------------------------
// Policy options
// ---------------------------------------------------------------------------

// PolicySelector sets the CEL selector on a policy.
func PolicySelector(cel string) PolicyOption {
	return func(p *oapi.Policy) { p.Selector = cel }
}

// PolicyEnabled sets whether the policy is enabled.
func PolicyEnabled(enabled bool) PolicyOption {
	return func(p *oapi.Policy) { p.Enabled = enabled }
}

// PolicyName sets the name of the policy.
func PolicyName(name string) PolicyOption {
	return func(p *oapi.Policy) { p.Name = name }
}

// WithPolicyRule adds a rule to the policy.
func WithPolicyRule(opts ...PolicyRuleOption) PolicyOption {
	return func(p *oapi.Policy) {
		rule := oapi.PolicyRule{
			Id:        uuid.New().String(),
			PolicyId:  p.Id,
			CreatedAt: time.Now().Format(time.RFC3339),
		}
		for _, o := range opts {
			o(&rule)
		}
		p.Rules = append(p.Rules, rule)
	}
}

// ---------------------------------------------------------------------------
// Policy rule options
// ---------------------------------------------------------------------------

// WithApprovalRule configures an any-approval rule on the policy rule.
func WithApprovalRule(minApprovals int32) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		r.AnyApproval = &oapi.AnyApprovalRule{MinApprovals: minApprovals}
	}
}

// WithDeploymentWindowRule configures a deployment window rule.
func WithDeploymentWindowRule(rrule string, durationMinutes int32) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		r.DeploymentWindow = &oapi.DeploymentWindowRule{
			Rrule:           rrule,
			DurationMinutes: durationMinutes,
		}
	}
}

// WithVersionSelectorRule configures a version selector rule with CEL.
func WithVersionSelectorRule(cel string) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		s := &oapi.Selector{}
		_ = s.FromCelSelector(oapi.CelSelector{Cel: cel})
		r.VersionSelector = &oapi.VersionSelectorRule{Selector: *s}
	}
}

// WithVersionCooldownRule configures a version cooldown rule.
func WithVersionCooldownRule(intervalSeconds int32) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		r.VersionCooldown = &oapi.VersionCooldownRule{IntervalSeconds: intervalSeconds}
	}
}

// ---------------------------------------------------------------------------
// Internal builders: convert ScenarioState into mock data
// ---------------------------------------------------------------------------

func buildSelectorResources(sc *ScenarioState) []selectoreval.ResourceInfo {
	out := make([]selectoreval.ResourceInfo, len(sc.Resources))
	for i, rd := range sc.Resources {
		meta := map[string]any{
			"labels": rd.Labels,
		}
		for k, v := range rd.Metadata {
			meta[k] = v
		}
		out[i] = selectoreval.ResourceInfo{
			ID: rd.ID,
			Raw: map[string]any{
				"name":     rd.Name,
				"kind":     rd.Kind,
				"metadata": meta,
			},
		}
	}
	return out
}

func buildReleaseTargets(sc *ScenarioState) []selectoreval.ReleaseTarget {
	out := make([]selectoreval.ReleaseTarget, len(sc.Resources))
	for i, rd := range sc.Resources {
		out[i] = selectoreval.ReleaseTarget{
			DeploymentID:  sc.DeploymentID,
			EnvironmentID: sc.EnvironmentID,
			ResourceID:    rd.ID,
		}
	}
	return out
}

func buildEvaluatorScope(sc *ScenarioState) *evaluator.EvaluatorScope {
	var resource *oapi.Resource
	if len(sc.Resources) > 0 {
		rd := sc.Resources[0]
		resource = &oapi.Resource{
			Id:       rd.ID.String(),
			Name:     rd.Name,
			Kind:     rd.Kind,
			Metadata: map[string]string{},
		}
	}

	return &evaluator.EvaluatorScope{
		Environment: &oapi.Environment{
			Id:   sc.EnvironmentID.String(),
			Name: sc.EnvironmentName,
		},
		Deployment: &oapi.Deployment{
			Id:   sc.DeploymentID.String(),
			Name: sc.DeploymentName,
		},
		Resource: resource,
	}
}
