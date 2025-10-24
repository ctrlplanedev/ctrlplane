package integration

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	c "workspace-engine/test/integration/creators"
)

// WorkspaceOption configures a TestWorkspace
type WorkspaceOption func(*TestWorkspace) error

// SystemOption configures a System
type SystemOption func(*TestWorkspace, *oapi.System, *eventsBuilder)

// DeploymentOption configures a Deployment
type DeploymentOption func(*TestWorkspace, *oapi.Deployment, *eventsBuilder)

// DeploymentVersionOption configures a DeploymentVersion
type DeploymentVersionOption func(*TestWorkspace, *oapi.DeploymentVersion)

// EnvironmentOption configures an Environment
type EnvironmentOption func(*TestWorkspace, *oapi.Environment)

// ResourceOption configures a Resource
type ResourceOption func(*TestWorkspace, *oapi.Resource, *eventsBuilder)

// JobAgentOption configures a JobAgent
type JobAgentOption func(*TestWorkspace, *oapi.JobAgent)

// ReleaseOption configures a Release
type ReleaseOption func(*TestWorkspace, *oapi.Release)

// PolicyOption configures a Policy
type PolicyOption func(*TestWorkspace, *oapi.Policy, *eventsBuilder)

// PolicyTargetSelectorOption configures a PolicyTargetSelector
type PolicyTargetSelectorOption func(*TestWorkspace, *oapi.PolicyTargetSelector)

// RelationshipRuleOption configures a RelationshipRule
type RelationshipRuleOption func(*TestWorkspace, *oapi.RelationshipRule) error

// PropertyMatcherOption configures a PropertyMatcher
type PropertyMatcherOption func(*TestWorkspace, *oapi.PropertyMatcher)

// ResourceVariableOption configures a ResourceVariable
type ResourceVariableOption func(*TestWorkspace, *oapi.ResourceVariable)

// DeploymentVariableOption configures a DeploymentVariable
type DeploymentVariableOption func(*TestWorkspace, *oapi.DeploymentVariable)

// DeploymentVariableValueOption configures a DeploymentVariableValue
type DeploymentVariableValueOption func(*TestWorkspace, *oapi.DeploymentVariableValue)

// ResourceProviderOption configures a ResourceProvider
type ResourceProviderOption func(*TestWorkspace, *oapi.ResourceProvider)

type event struct {
	Type handler.EventType
	Data any
}

type eventsBuilder struct {
	preEvents  []event
	postEvents []event
}

func newEventsBuilder() *eventsBuilder {
	return &eventsBuilder{
		preEvents:  []event{},
		postEvents: []event{},
	}
}

// ===== Workspace Options =====

func WithWorkspaceID(id string) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		ws.workspace.ID = id
		return nil
	}
}

func WithSystem(options ...SystemOption) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		s := c.NewSystem(ws.workspace.ID)

		eb := newEventsBuilder()
		for _, option := range options {
			option(ws, s, eb)
		}

		for _, event := range eb.preEvents {
			ws.PushEvent(context.Background(), event.Type, event.Data)
		}

		ws.PushEvent(context.Background(), handler.SystemCreate, s)

		for _, event := range eb.postEvents {
			ws.PushEvent(context.Background(), event.Type, event.Data)
		}

		return nil
	}
}

func WithResource(options ...ResourceOption) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		r := c.NewResource(ws.workspace.ID)
		eb := newEventsBuilder()

		for _, option := range options {
			option(ws, r, eb)
		}

		for _, event := range eb.preEvents {
			ws.PushEvent(context.Background(), event.Type, event.Data)
		}

		ws.PushEvent(
			context.Background(),
			handler.ResourceCreate,
			r,
		)

		for _, event := range eb.postEvents {
			ws.PushEvent(context.Background(), event.Type, event.Data)
		}

		return nil
	}
}

func WithJobAgent(options ...JobAgentOption) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		ja := c.NewJobAgent(ws.workspace.ID)

		for _, option := range options {
			option(ws, ja)
		}

		ws.PushEvent(
			context.Background(),
			handler.JobAgentCreate,
			ja,
		)

		return nil
	}
}

func WithPolicy(options ...PolicyOption) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		p := c.NewPolicy(ws.workspace.ID)

		eb := newEventsBuilder()
		for _, option := range options {
			option(ws, p, eb)
		}

		ws.PushEvent(
			context.Background(),
			handler.PolicyCreate,
			p,
		)

		return nil
	}
}

func WithRelationshipRule(options ...RelationshipRuleOption) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		rr := c.NewRelationshipRule(ws.workspace.ID)

		for _, option := range options {
			if err := option(ws, rr); err != nil {
				return err
			}
		}

		ws.PushEvent(
			context.Background(),
			handler.RelationshipRuleCreate,
			rr,
		)

		return nil
	}
}

func WithResourceVariable(key string, options ...ResourceVariableOption) ResourceOption {
	return func(ws *TestWorkspace, r *oapi.Resource, eb *eventsBuilder) {
		rv := c.NewResourceVariable(r.Id, key)

		for _, option := range options {
			option(ws, rv)
		}

		eb.postEvents = append(eb.postEvents, event{
			Type: handler.ResourceVariableCreate,
			Data: rv,
		})
	}
}

func WithDeploymentVariable(key string, options ...DeploymentVariableOption) DeploymentOption {
	return func(ws *TestWorkspace, d *oapi.Deployment, eb *eventsBuilder) {
		dv := c.NewDeploymentVariable(d.Id, key)

		for _, option := range options {
			option(ws, dv)
		}

		eb.postEvents = append(eb.postEvents, event{
			Type: handler.DeploymentVariableCreate,
			Data: dv,
		})
	}
}

func WithResourceProvider(options ...ResourceProviderOption) WorkspaceOption {
	return func(ws *TestWorkspace) error {
		rp := c.NewResourceProvider(ws.workspace.ID)

		for _, option := range options {
			option(ws, rp)
		}

		ws.PushEvent(
			context.Background(),
			handler.ResourceProviderCreate,
			rp,
		)

		return nil
	}
}

// ===== System Options =====

func SystemName(name string) SystemOption {
	return func(_ *TestWorkspace, s *oapi.System, _ *eventsBuilder) {
		s.Name = name
	}
}

func SystemDescription(description string) SystemOption {
	return func(_ *TestWorkspace, s *oapi.System, _ *eventsBuilder) {
		s.Description = &description
	}
}

func SystemID(id string) SystemOption {
	return func(_ *TestWorkspace, s *oapi.System, _ *eventsBuilder) {
		s.Id = id
	}
}

func WithDeployment(options ...DeploymentOption) SystemOption {
	return func(ws *TestWorkspace, s *oapi.System, eb *eventsBuilder) {
		d := c.NewDeployment(s.Id)
		d.SystemId = s.Id

		dvEB := newEventsBuilder()
		for _, option := range options {
			option(ws, d, dvEB)
		}

		eb.postEvents = append(eb.postEvents, event{
			Type: handler.DeploymentCreate,
			Data: d,
		})

		// Add deployment version events after deployment
		eb.postEvents = append(eb.postEvents, dvEB.postEvents...)
	}
}

func WithEnvironment(options ...EnvironmentOption) SystemOption {
	return func(ws *TestWorkspace, s *oapi.System, eb *eventsBuilder) {
		e := c.NewEnvironment(s.Id)
		e.SystemId = s.Id

		for _, option := range options {
			option(ws, e)
		}

		eb.postEvents = append(eb.postEvents, event{
			Type: handler.EnvironmentCreate,
			Data: e,
		})
	}
}

// ===== Deployment Options =====

func DeploymentName(name string) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		d.Name = name
		d.Slug = name
	}
}

func DeploymentDescription(description string) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		d.Description = &description
	}
}

func DeploymentID(id string) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		d.Id = id
	}
}

func DeploymentJobAgent(jobAgentID string) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		d.JobAgentId = &jobAgentID
	}
}

func DeploymentCelResourceSelector(cel string) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		s := &oapi.Selector{}
		_ = s.FromCelSelector(oapi.CelSelector{Cel: cel})
		d.ResourceSelector = s
	}
}

func DeploymentJsonResourceSelector(selector map[string]any) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		s := &oapi.Selector{}
		_ = s.FromJsonSelector(oapi.JsonSelector{Json: selector})
		d.ResourceSelector = s
	}
}

func DeploymentJobAgentConfig(config map[string]any) DeploymentOption {
	return func(_ *TestWorkspace, d *oapi.Deployment, _ *eventsBuilder) {
		d.JobAgentConfig = config
	}
}

// WithDeploymentVersion creates a deployment version for a deployment.
// Can be called multiple times to create multiple versions.
//
// Example:
//
//	integration.WithDeployment(
//	    integration.DeploymentName("api"),
//	    integration.WithDeploymentVersion(
//	        integration.DeploymentVersionTag("v1.0.0"),
//	        integration.DeploymentVersionConfig(map[string]any{
//	            "image": "myapp:v1.0.0",
//	        }),
//	    ),
//	    integration.WithDeploymentVersion(
//	        integration.DeploymentVersionTag("v1.1.0"),
//	    ),
//	)
func WithDeploymentVersion(options ...DeploymentVersionOption) DeploymentOption {
	return func(ws *TestWorkspace, d *oapi.Deployment, eb *eventsBuilder) {
		dv := c.NewDeploymentVersion()
		dv.DeploymentId = d.Id

		for _, option := range options {
			option(ws, dv)
		}

		eb.postEvents = append(eb.postEvents, event{
			Type: handler.DeploymentVersionCreate,
			Data: dv,
		})
	}
}

// ===== DeploymentVersion Options =====

func DeploymentVersionName(name string) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.Name = name
	}
}

func DeploymentVersionTag(tag string) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.Tag = tag
	}
}

func DeploymentVersionID(id string) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.Id = id
	}
}

func DeploymentVersionConfig(config map[string]any) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.Config = config
	}
}

func DeploymentVersionJobAgentConfig(config map[string]any) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.JobAgentConfig = config
	}
}

func DeploymentVersionStatus(status oapi.DeploymentVersionStatus) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.Status = status
	}
}

func DeploymentVersionMessage(message string) DeploymentVersionOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVersion) {
		dv.Message = &message
	}
}

// ===== Environment Options =====

func EnvironmentName(name string) EnvironmentOption {
	return func(_ *TestWorkspace, e *oapi.Environment) {
		e.Name = name
	}
}

func EnvironmentCelResourceSelector(cel string) EnvironmentOption {
	return func(_ *TestWorkspace, e *oapi.Environment) {
		s := &oapi.Selector{}
		_ = s.FromCelSelector(oapi.CelSelector{Cel: cel})
		e.ResourceSelector = s
	}
}

func EnvironmentDescription(description string) EnvironmentOption {
	return func(_ *TestWorkspace, e *oapi.Environment) {
		e.Description = &description
	}
}

func EnvironmentID(id string) EnvironmentOption {
	return func(_ *TestWorkspace, e *oapi.Environment) {
		e.Id = id
	}
}

func EnvironmentJsonResourceSelector(selector map[string]any) EnvironmentOption {
	return func(_ *TestWorkspace, e *oapi.Environment) {
		s := &oapi.Selector{}
		_ = s.FromJsonSelector(oapi.JsonSelector{Json: selector})
		e.ResourceSelector = s
	}
}

func EnvironmentNoResourceSelector() EnvironmentOption {
	return func(_ *TestWorkspace, e *oapi.Environment) {
		e.ResourceSelector = nil
	}
}

// ===== Resource Options =====

func ResourceName(name string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Name = name
	}
}

func ResourceID(id string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Id = id
	}
}

func ResourceKind(kind string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Kind = kind
	}
}

func ResourceVersion(version string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Version = version
	}
}

func ResourceIdentifier(identifier string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Identifier = identifier
	}
}

func ResourceConfig(config map[string]interface{}) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Config = config
	}
}

func ResourceMetadata(metadata map[string]string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.Metadata = metadata
	}
}

func ResourceProviderID(providerID string) ResourceOption {
	return func(_ *TestWorkspace, r *oapi.Resource, _ *eventsBuilder) {
		r.ProviderId = &providerID
	}
}

// ===== ResourceProvider Options =====

func ProviderName(name string) ResourceProviderOption {
	return func(_ *TestWorkspace, rp *oapi.ResourceProvider) {
		rp.Name = name
	}
}

func ProviderID(id string) ResourceProviderOption {
	return func(_ *TestWorkspace, rp *oapi.ResourceProvider) {
		rp.Id = id
	}
}

func ProviderMetadata(metadata map[string]string) ResourceProviderOption {
	return func(_ *TestWorkspace, rp *oapi.ResourceProvider) {
		rp.Metadata = metadata
	}
}

// ===== JobAgent Options =====

func JobAgentName(name string) JobAgentOption {
	return func(_ *TestWorkspace, ja *oapi.JobAgent) {
		ja.Name = name
	}
}

func JobAgentID(id string) JobAgentOption {
	return func(_ *TestWorkspace, ja *oapi.JobAgent) {
		ja.Id = id
	}
}

func JobAgentType(agentType string) JobAgentOption {
	return func(_ *TestWorkspace, ja *oapi.JobAgent) {
		ja.Type = agentType
	}
}

// ===== Policy Options =====

func PolicyName(name string) PolicyOption {
	return func(_ *TestWorkspace, p *oapi.Policy, _ *eventsBuilder) {
		p.Name = name
	}
}

func PolicyDescription(description string) PolicyOption {
	return func(_ *TestWorkspace, p *oapi.Policy, _ *eventsBuilder) {
		p.Description = &description
	}
}

func PolicyID(id string) PolicyOption {
	return func(_ *TestWorkspace, p *oapi.Policy, _ *eventsBuilder) {
		p.Id = id
	}
}

func WithPolicyTargetSelector(options ...PolicyTargetSelectorOption) PolicyOption {
	return func(ws *TestWorkspace, p *oapi.Policy, _ *eventsBuilder) {
		selector := c.NewPolicyTargetSelector()

		for _, option := range options {
			option(ws, selector)
		}

		p.Selectors = append(p.Selectors, *selector)
	}
}

// ===== PolicyTargetSelector Options =====

func PolicyTargetSelectorID(id string) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		s.Id = id
	}
}

func PolicyTargetJsonDeploymentSelector(selector map[string]any) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		sel := &oapi.Selector{}
		_ = sel.FromJsonSelector(oapi.JsonSelector{Json: selector})
		s.DeploymentSelector = sel
	}
}

func PolicyTargetCelDeploymentSelector(cel string) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		sel := &oapi.Selector{}
		_ = sel.FromCelSelector(oapi.CelSelector{Cel: cel})
		s.DeploymentSelector = sel
	}
}

func PolicyTargetCelEnvironmentSelector(cel string) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		sel := &oapi.Selector{}
		_ = sel.FromCelSelector(oapi.CelSelector{Cel: cel})
		s.EnvironmentSelector = sel
	}
}

func PolicyTargetJsonEnvironmentSelector(selector map[string]any) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		sel := &oapi.Selector{}
		_ = sel.FromJsonSelector(oapi.JsonSelector{Json: selector})
		s.EnvironmentSelector = sel
	}
}

func PolicyTargetJsonResourceSelector(selector map[string]any) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		sel := &oapi.Selector{}
		_ = sel.FromJsonSelector(oapi.JsonSelector{Json: selector})
		s.ResourceSelector = sel
	}
}

func PolicyTargetCelResourceSelector(cel string) PolicyTargetSelectorOption {
	return func(_ *TestWorkspace, s *oapi.PolicyTargetSelector) {
		sel := &oapi.Selector{}
		_ = sel.FromCelSelector(oapi.CelSelector{Cel: cel})
		s.ResourceSelector = sel
	}
}

// ===== RelationshipRule Options =====

func RelationshipRuleName(name string) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.Name = name
		return nil
	}
}

func RelationshipRuleDescription(description string) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.Description = &description
		return nil
	}
}

func RelationshipRuleID(id string) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.Id = id
		return nil
	}
}

func RelationshipRuleReference(reference string) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.Reference = reference
		return nil
	}
}

func RelationshipRuleFromType(fromType oapi.RelatableEntityType) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.FromType = fromType
		return nil
	}
}

func RelationshipRuleToType(toType oapi.RelatableEntityType) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.ToType = toType
		return nil
	}
}

func RelationshipRuleFromJsonSelector(selector map[string]any) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		s := &oapi.Selector{}
		if err := s.FromJsonSelector(oapi.JsonSelector{Json: selector}); err != nil {
			return err
		}
		rr.FromSelector = s
		return nil
	}
}

func RelationshipRuleToJsonSelector(selector map[string]any) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		s := &oapi.Selector{}
		if err := s.FromJsonSelector(oapi.JsonSelector{Json: selector}); err != nil {
			return err
		}
		rr.ToSelector = s
		return nil
	}
}

func RelationshipRuleType(relType string) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.RelationshipType = relType
		return nil
	}
}

func RelationshipRuleMetadata(metadata map[string]string) RelationshipRuleOption {
	return func(_ *TestWorkspace, rr *oapi.RelationshipRule) error {
		rr.Metadata = metadata
		return nil
	}
}

func WithPropertyMatcher(options ...PropertyMatcherOption) RelationshipRuleOption {
	return func(ws *TestWorkspace, rr *oapi.RelationshipRule) error {
		pm := c.NewPropertyMatcher([]string{}, []string{})

		for _, option := range options {
			option(ws, pm)
		}

		// Get existing properties matchers and append the new one
		existingMatcher, err := rr.Matcher.AsPropertiesMatcher()
		var existingProperties []oapi.PropertyMatcher
		if err == nil {
			existingProperties = existingMatcher.Properties
		}

		if err := rr.Matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
			Properties: append(existingProperties, *pm),
		}); err != nil {
			return err
		}

		return nil
	}
}

func WithCelMatcher(cel string) RelationshipRuleOption {
	return func(ws *TestWorkspace, rr *oapi.RelationshipRule) error {
		return rr.Matcher.FromCelMatcher(oapi.CelMatcher{Cel: cel})
	}
}

// ===== PropertyMatcher Options =====

func PropertyMatcherFromProperty(fromProperty []string) PropertyMatcherOption {
	return func(_ *TestWorkspace, pm *oapi.PropertyMatcher) {
		pm.FromProperty = fromProperty
	}
}

func PropertyMatcherToProperty(toProperty []string) PropertyMatcherOption {
	return func(_ *TestWorkspace, pm *oapi.PropertyMatcher) {
		pm.ToProperty = toProperty
	}
}

func PropertyMatcherOperator(operator oapi.PropertyMatcherOperator) PropertyMatcherOption {
	return func(_ *TestWorkspace, pm *oapi.PropertyMatcher) {
		pm.Operator = operator
	}
}

// ===== ResourceVariable Options =====

func ResourceVariableValue(value *oapi.Value) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *value
	}
}

func ResourceVariableLiteralValue(value any) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *c.NewValueFromLiteral(c.NewLiteralValue(value))
	}
}

func ResourceVariableStringValue(value string) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *c.NewValueFromString(value)
	}
}

func ResourceVariableIntValue(value int64) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *c.NewValueFromInt(value)
	}
}

func ResourceVariableBoolValue(value bool) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *c.NewValueFromBool(value)
	}
}

func ResourceVariableReferenceValue(reference string, path []string) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *c.NewValueFromReference(reference, path)
	}
}

func ResourceVariableSensitiveValue(valueHash string) ResourceVariableOption {
	return func(_ *TestWorkspace, rv *oapi.ResourceVariable) {
		rv.Value = *c.NewValueFromSensitive(valueHash)
	}
}

// ===== DeploymentVariable Options =====

func DeploymentVariableDefaultValue(value *oapi.LiteralValue) DeploymentVariableOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVariable) {
		dv.DefaultValue = value
	}
}

func DeploymentVariableLiteralValue(value any) DeploymentVariableOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVariable) {
		dv.DefaultValue = c.NewLiteralValue(value)
	}
}

func DeploymentVariableStringValue(value string) DeploymentVariableOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVariable) {
		literalValue := &oapi.LiteralValue{}
		_ = literalValue.FromStringValue(value)
		dv.DefaultValue = literalValue
	}
}

func DeploymentVariableIntValue(value int64) DeploymentVariableOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVariable) {
		literalValue := &oapi.LiteralValue{}
		_ = literalValue.FromIntegerValue(int(value))
		dv.DefaultValue = literalValue
	}
}

func DeploymentVariableBoolValue(value bool) DeploymentVariableOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVariable) {
		literalValue := &oapi.LiteralValue{}
		_ = literalValue.FromBooleanValue(value)
		dv.DefaultValue = literalValue
	}
}

func DeploymentVariableDescription(description string) DeploymentVariableOption {
	return func(_ *TestWorkspace, dv *oapi.DeploymentVariable) {
		dv.Description = &description
	}
}
