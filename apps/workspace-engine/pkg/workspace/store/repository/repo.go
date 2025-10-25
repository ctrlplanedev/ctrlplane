package repository

import (
	"encoding/gob"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
)

func EncodeGob(r *Repository) ([]byte, error) {
	var buf []byte
	writer := NewBufferWriter(&buf)
	encoder := gob.NewEncoder(writer)
	err := encoder.Encode(r)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

// BufferWriter implements io.Writer for a byte slice pointer
type BufferWriter struct {
	buf *[]byte
}

func NewBufferWriter(b *[]byte) *BufferWriter {
	return &BufferWriter{buf: b}
}

func (w *BufferWriter) Write(p []byte) (int, error) {
	*w.buf = append(*w.buf, p...)
	return len(p), nil
}

// registerEntity creates a cmap and registers it with the apply registry
func registerEntity[E any](registry *persistence.ApplyRegistry, entityType string) cmap.ConcurrentMap[string, E] {
	cm := cmap.New[E]()
	registry.Register(entityType, &RepositoryAdapter[E]{cm: &cm})
	return cm
}

func New() *Repository {
	registry := persistence.NewApplyRegistry()

	return &Repository{
		applyRegistry:       registry,
		Resources:           registerEntity[*oapi.Resource](registry, "resource"),
		ResourceProviders:   registerEntity[*oapi.ResourceProvider](registry, "resource_provider"),
		ResourceVariables:   registerEntity[*oapi.ResourceVariable](registry, "resource_variable"),
		Deployments:         registerEntity[*oapi.Deployment](registry, "deployment"),
		DeploymentVersions:  registerEntity[*oapi.DeploymentVersion](registry, "deployment_version"),
		DeploymentVariables: registerEntity[*oapi.DeploymentVariable](registry, "deployment_variable"),
		Environments:        registerEntity[*oapi.Environment](registry, "environment"),
		Policies:            registerEntity[*oapi.Policy](registry, "policy"),
		Systems:             registerEntity[*oapi.System](registry, "system"),
		Releases:            registerEntity[*oapi.Release](registry, "release"),
		Jobs:                registerEntity[*oapi.Job](registry, "job"),
		JobAgents:           registerEntity[*oapi.JobAgent](registry, "job_agent"),
		UserApprovalRecords: registerEntity[*oapi.UserApprovalRecord](registry, "user_approval_record"),
		RelationshipRules:   registerEntity[*oapi.RelationshipRule](registry, "relationship_rule"),
		GithubEntities:      registerEntity[*oapi.GithubEntity](registry, "github_entity"),
	}
}

type Repository struct {
	applyRegistry *persistence.ApplyRegistry

	Resources         cmap.ConcurrentMap[string, *oapi.Resource]
	ResourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	ResourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	Deployments         cmap.ConcurrentMap[string, *oapi.Deployment]
	DeploymentVariables cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	DeploymentVersions  cmap.ConcurrentMap[string, *oapi.DeploymentVersion]

	Environments cmap.ConcurrentMap[string, *oapi.Environment]
	Policies     cmap.ConcurrentMap[string, *oapi.Policy]
	Systems      cmap.ConcurrentMap[string, *oapi.System]
	Releases     cmap.ConcurrentMap[string, *oapi.Release]

	Jobs      cmap.ConcurrentMap[string, *oapi.Job]
	JobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	UserApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]

	GithubEntities cmap.ConcurrentMap[string, *oapi.GithubEntity]
}

func (r *Repository) ApplyRegistry() *persistence.ApplyRegistry {
	return r.applyRegistry
}
