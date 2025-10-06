package integration

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	c "workspace-engine/test/integration/creators"

	"google.golang.org/protobuf/types/known/structpb"
)

// WorkspaceOption configures a TestWorkspace
type WorkspaceOption func(*TestWorkspace)

// SystemOption configures a System
type SystemOption func(*TestWorkspace, *pb.System, *eventsBuilder)

// DeploymentOption configures a Deployment
type DeploymentOption func(*TestWorkspace, *pb.Deployment)

// EnvironmentOption configures an Environment
type EnvironmentOption func(*TestWorkspace, *pb.Environment)

// ResourceOption configures a Resource
type ResourceOption func(*TestWorkspace, *pb.Resource)

// JobAgentOption configures a JobAgent
type JobAgentOption func(*TestWorkspace, *pb.JobAgent)

// ReleaseOption configures a Release
type ReleaseOption func(*TestWorkspace, *pb.Release)


type event struct {
	Type handler.EventType
	Data any
}

type eventsBuilder struct {
	preEvents []event
	postEvents []event
}

func newEventsBuilder() *eventsBuilder {
	return &eventsBuilder{
		preEvents: []event{},
		postEvents: []event{},
	}
}

// ===== Workspace Options =====

func WithWorkspaceID(id string) WorkspaceOption {
	return func(ws *TestWorkspace) {
		ws.workspace.ID = id
	}
}

func WithSystem(options ...SystemOption) WorkspaceOption {
	return func(ws *TestWorkspace) {
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
	}
}

func WithResource(options ...ResourceOption) WorkspaceOption {
	return func(ws *TestWorkspace) {
		r := c.NewResource(ws.workspace.ID)

		for _, option := range options {
			option(ws, r)
		}

		ws.PushEvent(
			context.Background(),
			handler.ResourceCreate,
			r,
		)
	}
}

func WithJobAgent(options ...JobAgentOption) WorkspaceOption {
	return func(ws *TestWorkspace) {
		ja := c.NewJobAgent()
		ja.WorkspaceId = ws.workspace.ID

		for _, option := range options {
			option(ws, ja)
		}

		ws.PushEvent(
			context.Background(),
			handler.JobAgentCreate,
			ja,
		)
	}
}

// ===== System Options =====

func SystemName(name string) SystemOption {
	return func(_ *TestWorkspace, s *pb.System, _ *eventsBuilder) {
		s.Name = name
	}
}

func SystemDescription(description string) SystemOption {
	return func(_ *TestWorkspace, s *pb.System, _ *eventsBuilder) {
		s.Description = description
	}
}

func SystemID(id string) SystemOption {
	return func(_ *TestWorkspace, s *pb.System, _ *eventsBuilder) {
		s.Id = id
	}
}

func WithDeployment(options ...DeploymentOption) SystemOption {
	return func(ws *TestWorkspace, s *pb.System, eb *eventsBuilder) {
		d := c.NewDeployment(s.Id)
		d.SystemId = s.Id

		for _, option := range options {
			option(ws, d)
		}


		eb.postEvents = append(eb.postEvents, event{
			Type: handler.DeploymentCreate,
			Data: d,
		})
	}
}

func WithEnvironment(options ...EnvironmentOption) SystemOption {
	return func(ws *TestWorkspace, s *pb.System, eb *eventsBuilder) {
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
	return func(_ *TestWorkspace, d *pb.Deployment) {
		d.Name = name
		d.Slug = name
	}
}

func DeploymentDescription(description string) DeploymentOption {
	return func(_ *TestWorkspace, d *pb.Deployment) {
		d.Description = description
	}
}

func DeploymentID(id string) DeploymentOption {
	return func(_ *TestWorkspace, d *pb.Deployment) {
		d.Id = id
	}
}

func DeploymentJobAgent(jobAgentID string) DeploymentOption {
	return func(_ *TestWorkspace, d *pb.Deployment) {
		d.JobAgentId = &jobAgentID
	}
}

func DeploymentResourceSelector(selector map[string]any) DeploymentOption {
	return func(_ *TestWorkspace, d *pb.Deployment) {
		d.ResourceSelector = c.MustNewStructFromMap(selector)
	}
}

// ===== Environment Options =====

func EnvironmentName(name string) EnvironmentOption {
	return func(_ *TestWorkspace, e *pb.Environment) {
		e.Name = name
	}
}

func EnvironmentDescription(description string) EnvironmentOption {
	return func(_ *TestWorkspace, e *pb.Environment) {
		e.Description = description
	}
}

func EnvironmentID(id string) EnvironmentOption {
	return func(_ *TestWorkspace, e *pb.Environment) {
		e.Id = id
	}
}

func EnvironmentResourceSelector(selector map[string]any) EnvironmentOption {
	return func(_ *TestWorkspace, e *pb.Environment) {
		e.ResourceSelector = c.MustNewStructFromMap(selector)
	}
}
// ===== Resource Options =====

func ResourceName(name string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Name = name
	}
}

func ResourceID(id string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Id = id
	}
}

func ResourceKind(kind string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Kind = kind
	}
}

func ResourceVersion(version string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Version = version
	}
}

func ResourceIdentifier(identifier string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Identifier = identifier
	}
}

func ResourceConfig(config *structpb.Struct) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Config = config
	}
}

func ResourceMetadata(metadata map[string]string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.Metadata = metadata
	}
}

func ResourceProviderID(providerID string) ResourceOption {
	return func(_ *TestWorkspace, r *pb.Resource) {
		r.ProviderId = &providerID
	}
}

// ===== JobAgent Options =====

func JobAgentName(name string) JobAgentOption {
	return func(_ *TestWorkspace, ja *pb.JobAgent) {
		ja.Name = name
	}
}

func JobAgentID(id string) JobAgentOption {
	return func(_ *TestWorkspace, ja *pb.JobAgent) {
		ja.Id = id
	}
}

func JobAgentType(agentType string) JobAgentOption {
	return func(_ *TestWorkspace, ja *pb.JobAgent) {
		ja.Type = agentType
	}
}
