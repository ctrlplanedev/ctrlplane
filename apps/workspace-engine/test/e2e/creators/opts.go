package creators

import (
	"reflect"
	"time"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func SetField(dv any, key string, value any) {
	if dv == nil {
		return
	}
	rv := reflect.ValueOf(dv)
	if rv.Kind() != 1 || rv.IsNil() {
		return
	}

	elem := rv.Elem()
	if elem.Kind() != reflect.Struct {
		return
	}

	field := elem.FieldByName(key)
	if field.IsValid() && field.CanSet() {
		field.Set(reflect.ValueOf(value))
	}
}

// DeploymentVersionOption is a functional option for configuring a DeploymentVersion
type Option func(any)

// WithID sets the ID for the deployment version
func WithID(id string) Option {
	return func(dv any) {
		SetField(dv, "Id", id)
	}
}

// WithName sets the name for the deployment version
func WithName(name string) Option {
	return func(dv any) {
		SetField(dv, "Name", name)
	}
}

// WithTag sets the tag for the deployment version
func WithTag(tag string) Option {
	return func(dv any) {
		SetField(dv, "Tag", tag)
	}
}

// WithConfig sets the config for the deployment version
func WithConfig(config map[string]any) Option {
	return func(dv any) {
		SetField(dv, "Config", MustNewStructFromMap(config))
	}
}

// WithJobAgentConfig sets the job agent config for the deployment version
func WithJobAgentConfig(jobAgentConfig map[string]any) Option {
	return func(dv any) {
		SetField(dv, "JobAgentConfig", MustNewStructFromMap(jobAgentConfig))
	}
}

// WithDeploymentID sets the deployment ID for the deployment version
func WithDeploymentID(deploymentID string) Option {
	return func(dv any) {
		SetField(dv, "DeploymentId", deploymentID)
	}
}

// WithStatus sets the status for the deployment version
func WithStatus(status pb.DeploymentVersionStatus) Option {
	return func(dv any) {
		SetField(dv, "Status", status)
	}
}

// WithMessage sets the message for the deployment version
func WithMessage(message string) Option {
	return func(dv any) {
		SetField(dv, "Message", &message)
	}
}

// WithCreatedAt sets the created at timestamp for the deployment version
func WithCreatedAt(createdAt time.Time) Option {
	return func(dv any) {
		SetField(dv, "CreatedAt", createdAt.Format(time.RFC3339))
	}
}

func WithResourceSelector(resourceSelector unknown.UnknownCondition) Option {
	return func(dv any) {
		m := resourceSelector.AsMap()
		SetField(dv, "ResourceSelector", MustNewStructFromMap(m))
	}
}

// WithVersion sets the version for a resource
func WithVersion(version string) Option {
	return func(r any) {
		SetField(r, "Version", version)
	}
}

// WithKind sets the kind for a resource
func WithKind(kind string) Option {
	return func(r any) {
		SetField(r, "Kind", kind)
	}
}

// WithIdentifier sets the identifier for a resource
func WithIdentifier(identifier string) Option {
	return func(r any) {
		SetField(r, "Identifier", identifier)
	}
}

// WithWorkspaceID sets the workspace ID for a resource
func WithWorkspaceID(workspaceID string) Option {
	return func(r any) {
		SetField(r, "WorkspaceId", workspaceID)
	}
}

// WithProviderID sets the provider ID for a resource
func WithProviderID(providerID string) Option {
	return func(r any) {
		SetField(r, "ProviderId", &providerID)
	}
}

// WithMetadata sets the metadata for a resource
func WithMetadata(metadata map[string]string) Option {
	return func(r any) {
		SetField(r, "Metadata", metadata)
	}
}
