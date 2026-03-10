package harness

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"
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

// PolicySkipOption configures a policy skip within a scenario.
type PolicySkipOption func(*oapi.PolicySkip)

// ---------------------------------------------------------------------------
// Top-level pipeline options
// ---------------------------------------------------------------------------

// WithDeployment configures the deployment for the scenario.
func WithDeployment(opts ...DeploymentOption) PipelineOption {
	return func(sc *ScenarioState) {
		for _, o := range opts {
			o(sc)
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

// WithPolicySkip adds a policy skip to the scenario. The skip is pre-populated
// with sensible defaults; use PolicySkipOption funcs to customise individual fields.
func WithPolicySkip(ruleID, versionID string, opts ...PolicySkipOption) PipelineOption {
	return func(sc *ScenarioState) {
		ps := &oapi.PolicySkip{
			Id:        uuid.New().String(),
			RuleId:    ruleID,
			VersionId: versionID,
			Reason:    "test skip",
			CreatedAt: time.Now(),
			CreatedBy: "test-admin",
		}
		for _, o := range opts {
			o(ps)
		}
		sc.PolicySkips = append(sc.PolicySkips, ps)
	}
}

// ApprovalRecordOption configures a UserApprovalRecord.
type ApprovalRecordOption func(*oapi.UserApprovalRecord)

// ApprovalRecordReason sets the reason on an approval record.
func ApprovalRecordReason(reason string) ApprovalRecordOption {
	return func(r *oapi.UserApprovalRecord) { r.Reason = &reason }
}

// ApprovalRecordCreatedAt sets the creation time on an approval record.
func ApprovalRecordCreatedAt(t time.Time) ApprovalRecordOption {
	return func(r *oapi.UserApprovalRecord) { r.CreatedAt = t.Format(time.RFC3339) }
}

// ApprovalRecordUserID sets the user ID on an approval record.
func ApprovalRecordUserID(userID string) ApprovalRecordOption {
	return func(r *oapi.UserApprovalRecord) { r.UserId = userID }
}

// WithApprovalRecord adds a pre-seeded approval record to the scenario.
// The record's VersionId and EnvironmentId are populated from the scenario
// at build time unless overridden by opts.
func WithApprovalRecord(
	status oapi.ApprovalStatus,
	versionID, environmentID string,
	opts ...ApprovalRecordOption,
) PipelineOption {
	return func(sc *ScenarioState) {
		rec := &oapi.UserApprovalRecord{
			Status:        status,
			VersionId:     versionID,
			EnvironmentId: environmentID,
			UserId:        "test-user",
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		for _, o := range opts {
			o(rec)
		}
		sc.ApprovalRecords = append(sc.ApprovalRecords, rec)
	}
}

// PolicySkipReason overrides the default reason on a policy skip.
func PolicySkipReason(reason string) PolicySkipOption {
	return func(ps *oapi.PolicySkip) { ps.Reason = reason }
}

// PolicySkipExpiresAt sets an expiration time on a policy skip.
func PolicySkipExpiresAt(t time.Time) PolicySkipOption {
	return func(ps *oapi.PolicySkip) { ps.ExpiresAt = &t }
}

// PolicySkipCreatedAt overrides the creation time of a policy skip.
func PolicySkipCreatedAt(t time.Time) PolicySkipOption {
	return func(ps *oapi.PolicySkip) { ps.CreatedAt = t }
}

// PolicySkipEnvironment scopes a policy skip to a specific environment.
func PolicySkipEnvironment(envID string) PolicySkipOption {
	return func(ps *oapi.PolicySkip) { ps.EnvironmentId = &envID }
}

// PolicySkipResource scopes a policy skip to a specific resource.
func PolicySkipResource(resourceID string) PolicySkipOption {
	return func(ps *oapi.PolicySkip) { ps.ResourceId = &resourceID }
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

// VersionCreatedAt sets the creation time on a deployment version.
func VersionCreatedAt(t time.Time) VersionOption {
	return func(v *oapi.DeploymentVersion) { v.CreatedAt = t }
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

// PolicyRuleID sets a specific ID on the policy rule, allowing tests to
// reference it when creating policy skips.
func PolicyRuleID(id string) PolicyRuleOption {
	return func(r *oapi.PolicyRule) { r.Id = id }
}

// WithApprovalRule configures an any-approval rule on the policy rule.
func WithApprovalRule(minApprovals int32) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		r.AnyApproval = &oapi.AnyApprovalRule{MinApprovals: minApprovals}
	}
}

// DeploymentWindowOption configures fields on a DeploymentWindowRule.
type DeploymentWindowOption func(*oapi.DeploymentWindowRule)

// DenyWindow configures the deployment window as a deny window.
func DenyWindow() DeploymentWindowOption {
	return func(r *oapi.DeploymentWindowRule) {
		f := false
		r.AllowWindow = &f
	}
}

// AllowWindow explicitly marks the deployment window as an allow window.
func AllowWindow() DeploymentWindowOption {
	return func(r *oapi.DeploymentWindowRule) {
		t := true
		r.AllowWindow = &t
	}
}

// WindowTimezone sets the IANA timezone on the deployment window rule.
func WindowTimezone(tz string) DeploymentWindowOption {
	return func(r *oapi.DeploymentWindowRule) {
		r.Timezone = &tz
	}
}

// WithDeploymentWindowRule configures a deployment window rule.
func WithDeploymentWindowRule(
	rrule string,
	durationMinutes int32,
	opts ...DeploymentWindowOption,
) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rrule,
			DurationMinutes: durationMinutes,
		}
		for _, o := range opts {
			o(rule)
		}
		r.DeploymentWindow = rule
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

// WithGradualRolloutRule configures a gradual rollout rule with the given
// time scale interval (seconds) and rollout type ("linear" or "linear-normalized").
func WithGradualRolloutRule(
	timeScaleInterval int32,
	rolloutType oapi.GradualRolloutRuleRolloutType,
) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		r.GradualRollout = &oapi.GradualRolloutRule{
			TimeScaleInterval: timeScaleInterval,
			RolloutType:       rolloutType,
		}
	}
}

// WithDeploymentDependencyRule configures a deployment dependency rule with a
// CEL expression that matches upstream deployment(s).
func WithDeploymentDependencyRule(dependsOn string) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		r.DeploymentDependency = &oapi.DeploymentDependencyRule{
			DependsOn: dependsOn,
		}
	}
}

// EnvironmentProgressionOption configures fields on an EnvironmentProgressionRule.
type EnvironmentProgressionOption func(*oapi.EnvironmentProgressionRule)

// EnvProgressionMinSuccessPercentage sets the minimum success percentage
// required in the dependency environment before progression is allowed.
func EnvProgressionMinSuccessPercentage(pct float32) EnvironmentProgressionOption {
	return func(r *oapi.EnvironmentProgressionRule) {
		r.MinimumSuccessPercentage = &pct
	}
}

// EnvProgressionMinSoakTimeMinutes sets the minimum soak time (minutes) to
// wait after the dependency environment reaches a success state.
func EnvProgressionMinSoakTimeMinutes(minutes int32) EnvironmentProgressionOption {
	return func(r *oapi.EnvironmentProgressionRule) {
		r.MinimumSockTimeMinutes = &minutes
	}
}

// EnvProgressionMaxAgeHours sets the maximum age (hours) of a dependency
// deployment before progression is blocked.
func EnvProgressionMaxAgeHours(hours int32) EnvironmentProgressionOption {
	return func(r *oapi.EnvironmentProgressionRule) {
		r.MaximumAgeHours = &hours
	}
}

// EnvProgressionSuccessStatuses sets the job statuses considered "success"
// when evaluating the dependency environment.
func EnvProgressionSuccessStatuses(statuses ...oapi.JobStatus) EnvironmentProgressionOption {
	return func(r *oapi.EnvironmentProgressionRule) {
		r.SuccessStatuses = &statuses
	}
}

// WithEnvironmentProgressionRule configures an environment progression rule.
// The dependsOnSelector is a CEL expression matching dependency environments.
// Use EnvironmentProgressionOption funcs to configure success percentage,
// soak time, max age, and success statuses.
func WithEnvironmentProgressionRule(
	dependsOnSelector string,
	opts ...EnvironmentProgressionOption,
) PolicyRuleOption {
	return func(r *oapi.PolicyRule) {
		sel := &oapi.Selector{}
		_ = sel.FromCelSelector(oapi.CelSelector{Cel: dependsOnSelector})
		rule := &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: *sel,
		}
		for _, o := range opts {
			o(rule)
		}
		r.EnvironmentProgression = rule
	}
}

// ---------------------------------------------------------------------------
// Variable options
// ---------------------------------------------------------------------------

// DeploymentVarOption configures a deployment variable within a scenario.
type DeploymentVarOption func(*oapi.DeploymentVariableWithValues)

// VariableValueOption configures a deployment variable value.
type VariableValueOption func(*oapi.DeploymentVariableValue)

// WithDeploymentVariable adds a deployment variable to the scenario.
func WithDeploymentVariable(key string, opts ...DeploymentVarOption) PipelineOption {
	return func(sc *ScenarioState) {
		dv := oapi.DeploymentVariableWithValues{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: sc.DeploymentID.String(),
				Key:          key,
			},
		}
		for _, o := range opts {
			o(&dv)
		}
		sc.DeploymentVars = append(sc.DeploymentVars, dv)
	}
}

// DefaultValue sets the default literal value on a deployment variable.
func DefaultValue(val any) DeploymentVarOption {
	return func(dv *oapi.DeploymentVariableWithValues) {
		dv.Variable.DefaultValue = oapi.NewLiteralValue(val)
	}
}

// WithVariableValue adds a deployment variable value entry.
func WithVariableValue(value oapi.Value, opts ...VariableValueOption) DeploymentVarOption {
	return func(dv *oapi.DeploymentVariableWithValues) {
		dvv := oapi.DeploymentVariableValue{
			Id:                   uuid.New().String(),
			DeploymentVariableId: dv.Variable.Id,
			Value:                value,
			Priority:             0,
		}
		for _, o := range opts {
			o(&dvv)
		}
		dv.Values = append(dv.Values, dvv)
	}
}

// ValuePriority sets the priority on a deployment variable value.
func ValuePriority(p int64) VariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) { dvv.Priority = p }
}

// ValueSelector sets a CEL resource selector on a deployment variable value,
// so it only applies to resources matching the selector.
func ValueSelector(cel string) VariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		s := &oapi.Selector{}
		_ = s.FromCelSelector(oapi.CelSelector{Cel: cel})
		dvv.ResourceSelector = s
	}
}

// WithResourceVariable adds a resource variable to the scenario. The variable
// is keyed by the given key and applies to the first resource in the scenario.
func WithResourceVariable(key string, value oapi.Value) PipelineOption {
	return func(sc *ScenarioState) {
		if sc.ResourceVars == nil {
			sc.ResourceVars = make(map[string]oapi.ResourceVariable)
		}
		resourceID := ""
		if len(sc.Resources) > 0 {
			resourceID = sc.Resources[0].ID.String()
		}
		sc.ResourceVars[key] = oapi.ResourceVariable{
			Key:        key,
			ResourceId: resourceID,
			Value:      value,
		}
	}
}

// JobAgentOption configures a job agent within a scenario.
type JobAgentOption func(*oapi.JobAgent)

// WithJobAgent adds a job agent to the scenario. The agent will be returned
// by the JobDispatchGetter when the job dispatch controller asks for agents
// configured on the deployment.
func WithJobAgent(agentType string, opts ...JobAgentOption) PipelineOption {
	return func(sc *ScenarioState) {
		agent := oapi.JobAgent{
			Id:          uuid.New().String(),
			Name:        fmt.Sprintf("agent-%d", len(sc.JobAgents)+1),
			Type:        agentType,
			Config:      oapi.JobAgentConfig{},
			WorkspaceId: sc.WorkspaceID.String(),
		}
		for _, o := range opts {
			o(&agent)
		}
		sc.JobAgents = append(sc.JobAgents, agent)
	}
}

// JobAgentName sets the name on a job agent.
func JobAgentName(name string) JobAgentOption {
	return func(a *oapi.JobAgent) { a.Name = name }
}

// JobAgentConfig sets the config on a job agent.
func JobAgentConfig(config oapi.JobAgentConfig) JobAgentOption {
	return func(a *oapi.JobAgent) { a.Config = config }
}

// JobAgentID sets the ID on a job agent.
func JobAgentID(id string) JobAgentOption {
	return func(a *oapi.JobAgent) { a.Id = id }
}

// WithRelatedResource registers a related resource under the given reference
// name, enabling reference variable resolution. It creates a CEL-based
// relationship rule that matches the primary resource to the related
// resource by ID, and adds the related resource as a candidate entity.
func WithRelatedResource(reference string, res *oapi.Resource) PipelineOption {
	return func(sc *ScenarioState) {
		relatedID := uuid.MustParse(res.Id)

		cel := fmt.Sprintf(
			`from.type == "resource" && to.type == "resource" && to.id == "%s"`,
			relatedID.String(),
		)
		sc.RelationshipRules = append(sc.RelationshipRules, eval.Rule{
			ID:        uuid.New(),
			Reference: reference,
			Cel:       cel,
		})

		if sc.Candidates == nil {
			sc.Candidates = make(map[string][]eval.EntityData)
		}

		metadata := make(map[string]any, len(res.Metadata))
		for k, v := range res.Metadata {
			metadata[k] = v
		}
		sc.Candidates["resource"] = append(sc.Candidates["resource"], eval.EntityData{
			ID:          relatedID,
			WorkspaceID: sc.WorkspaceID,
			EntityType:  "resource",
			Raw: map[string]any{
				"type":       "resource",
				"id":         relatedID.String(),
				"name":       res.Name,
				"kind":       res.Kind,
				"version":    res.Version,
				"identifier": res.Identifier,
				"config":     res.Config,
				"metadata":   metadata,
			},
		})
	}
}

// LiteralValue creates an oapi.Value wrapping a literal Go value.
func LiteralValue(val any) oapi.Value {
	lv := oapi.NewLiteralValue(val)
	return *oapi.NewValueFromLiteral(lv)
}

// ReferenceValue creates an oapi.Value pointing to a named relationship path.
func ReferenceValue(reference string, path ...string) oapi.Value {
	v := &oapi.Value{}
	_ = v.FromReferenceValue(oapi.ReferenceValue{
		Reference: reference,
		Path:      path,
	})
	return *v
}

// ---------------------------------------------------------------------------
// Internal builders: convert ScenarioState into mock data
// ---------------------------------------------------------------------------

func buildSelectorResources(sc *ScenarioState) []*oapi.Resource {
	out := make([]*oapi.Resource, len(sc.Resources))
	for i, rd := range sc.Resources {
		metadata := make(map[string]string)
		for k, v := range rd.Labels {
			metadata[k] = fmt.Sprintf("%v", v)
		}
		for k, v := range rd.Metadata {
			metadata[k] = fmt.Sprintf("%v", v)
		}
		out[i] = &oapi.Resource{
			Id:       rd.ID.String(),
			Name:     rd.Name,
			Kind:     rd.Kind,
			Metadata: metadata,
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
		metadata := make(map[string]string)
		for k, v := range rd.Metadata {
			metadata[k] = fmt.Sprintf("%v", v)
		}
		for k, v := range rd.Labels {
			metadata[k] = fmt.Sprintf("%v", v)
		}
		resource = &oapi.Resource{
			Id:          rd.ID.String(),
			Name:        rd.Name,
			Kind:        rd.Kind,
			WorkspaceId: sc.WorkspaceID.String(),
			Metadata:    metadata,
		}
	}

	return &evaluator.EvaluatorScope{
		Environment: &oapi.Environment{
			Id:          sc.EnvironmentID.String(),
			Name:        sc.EnvironmentName,
			WorkspaceId: sc.WorkspaceID.String(),
		},
		Deployment: &oapi.Deployment{
			Id:   sc.DeploymentID.String(),
			Name: sc.DeploymentName,
		},
		Resource: resource,
	}
}
