package repository

import (
	"time"
	"workspace-engine/pkg/oapi"
)

// ResourceSummary is a lightweight projection of a resource containing only
// scalar columns (no JSONB config/metadata). Used for fast batch lookups
// where full resource data isn't needed upfront.
type ResourceSummary struct {
	Id         string
	Identifier string
	ProviderId *string
	Version    string
	Name       string
	Kind       string
	CreatedAt  time.Time
	UpdatedAt  *time.Time
}

// DeploymentVersionRepo defines the contract for deployment version storage.
// Implementations include the in-memory indexstore and the DB-backed store.
type DeploymentVersionRepo interface {
	Get(id string) (*oapi.DeploymentVersion, bool)
	GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error)
	Set(entity *oapi.DeploymentVersion) error
	Remove(id string) error
	Items() map[string]*oapi.DeploymentVersion
}

// DeploymentRepo defines the contract for deployment storage.
type DeploymentRepo interface {
	Get(id string) (*oapi.Deployment, bool)
	Set(entity *oapi.Deployment) error
	Remove(id string) error
	Items() map[string]*oapi.Deployment
}

// EnvironmentRepo defines the contract for environment storage.
type EnvironmentRepo interface {
	Get(id string) (*oapi.Environment, bool)
	Set(entity *oapi.Environment) error
	Remove(id string) error
	Items() map[string]*oapi.Environment
}

// SystemDeploymentRepo manages system <-> deployment associations.
type SystemDeploymentRepo interface {
	GetSystemIDsForDeployment(deploymentID string) []string
	GetDeploymentIDsForSystem(systemID string) []string
	Link(systemID, deploymentID string) error
	Unlink(systemID, deploymentID string) error
}

// SystemEnvironmentRepo manages system <-> environment associations.
type SystemEnvironmentRepo interface {
	GetSystemIDsForEnvironment(environmentID string) []string
	GetEnvironmentIDsForSystem(systemID string) []string
	Link(systemID, environmentID string) error
	Unlink(systemID, environmentID string) error
}

// SystemRepo defines the contract for system storage.
type SystemRepo interface {
	Get(id string) (*oapi.System, bool)
	Set(entity *oapi.System) error
	Remove(id string) error
	Items() map[string]*oapi.System
}

// JobAgentRepo defines the contract for job agent storage.
type JobAgentRepo interface {
	Get(id string) (*oapi.JobAgent, bool)
	Set(entity *oapi.JobAgent) error
	Remove(id string) error
	Items() map[string]*oapi.JobAgent
}

// ResourceRepo defines the contract for resource storage.
type ResourceRepo interface {
	Get(id string) (*oapi.Resource, bool)
	GetByIdentifier(identifier string) (*oapi.Resource, bool)
	GetByIdentifiers(identifiers []string) map[string]*oapi.Resource
	GetSummariesByIdentifiers(identifiers []string) map[string]*ResourceSummary
	ListByProviderID(providerID string) []*oapi.Resource
	Set(entity *oapi.Resource) error
	SetBatch(entities []*oapi.Resource) error
	Remove(id string) error
	RemoveBatch(ids []string) error
	Items() map[string]*oapi.Resource
}

// ResourceProviderRepo defines the contract for resource provider storage.
type ResourceProviderRepo interface {
	Get(id string) (*oapi.ResourceProvider, bool)
	Set(entity *oapi.ResourceProvider) error
	Remove(id string) error
	Items() map[string]*oapi.ResourceProvider
}

// ReleaseRepo defines the contract for release storage.
type ReleaseRepo interface {
	Get(id string) (*oapi.Release, bool)
	GetByReleaseTargetKey(key string) ([]*oapi.Release, error)
	Set(entity *oapi.Release) error
	Remove(id string) error
	Items() map[string]*oapi.Release
}

// PolicyRepo defines the contract for policy storage.
// Implementations handle both the policy and its associated rules.
type PolicyRepo interface {
	Get(id string) (*oapi.Policy, bool)
	Set(entity *oapi.Policy) error
	Remove(id string) error
	Items() map[string]*oapi.Policy
}

// DeploymentVariableRepo defines the contract for deployment variable storage.
type DeploymentVariableRepo interface {
	Get(id string) (*oapi.DeploymentVariable, bool)
	Set(entity *oapi.DeploymentVariable) error
	Remove(id string) error
	Items() map[string]*oapi.DeploymentVariable
	GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVariable, error)
}

// DeploymentVariableValueRepo defines the contract for deployment variable value storage.
type DeploymentVariableValueRepo interface {
	Get(id string) (*oapi.DeploymentVariableValue, bool)
	Set(entity *oapi.DeploymentVariableValue) error
	Remove(id string) error
	Items() map[string]*oapi.DeploymentVariableValue
	GetByVariableID(variableID string) ([]*oapi.DeploymentVariableValue, error)
}

// WorkflowRepo defines the contract for workflow storage.
type WorkflowRepo interface {
	Get(id string) (*oapi.Workflow, bool)
	Set(entity *oapi.Workflow) error
	Remove(id string) error
	Items() map[string]*oapi.Workflow
}

// WorkflowJobTemplateRepo defines the contract for workflow job template storage.
type WorkflowJobTemplateRepo interface {
	Get(id string) (*oapi.WorkflowJobTemplate, bool)
	Set(entity *oapi.WorkflowJobTemplate) error
	Remove(id string) error
	Items() map[string]*oapi.WorkflowJobTemplate
}

// WorkflowRunRepo defines the contract for workflow run storage.
type WorkflowRunRepo interface {
	Get(id string) (*oapi.WorkflowRun, bool)
	Set(entity *oapi.WorkflowRun) error
	Remove(id string) error
	Items() map[string]*oapi.WorkflowRun
	GetByWorkflowID(workflowID string) ([]*oapi.WorkflowRun, error)
}

// WorkflowJobRepo defines the contract for workflow job storage.
type WorkflowJobRepo interface {
	Get(id string) (*oapi.WorkflowJob, bool)
	Set(entity *oapi.WorkflowJob) error
	Remove(id string) error
	Items() map[string]*oapi.WorkflowJob
	GetByWorkflowRunID(workflowRunID string) ([]*oapi.WorkflowJob, error)
}

// ResourceVariableRepo defines the contract for resource variable storage.
type ResourceVariableRepo interface {
	Get(key string) (*oapi.ResourceVariable, bool)
	Set(entity *oapi.ResourceVariable) error
	Remove(key string) error
	Items() map[string]*oapi.ResourceVariable
	GetByResourceID(resourceID string) ([]*oapi.ResourceVariable, error)
	BulkUpdate(toUpsert []*oapi.ResourceVariable, toRemove []*oapi.ResourceVariable) error
}

// JobRepo defines the contract for job storage.
type JobRepo interface {
	Get(id string) (*oapi.Job, bool)
	Set(entity *oapi.Job) error
	Remove(id string) error
	Items() map[string]*oapi.Job
	GetByReleaseID(releaseID string) ([]*oapi.Job, error)
	GetByJobAgentID(jobAgentID string) ([]*oapi.Job, error)
	GetByWorkflowJobID(workflowJobID string) ([]*oapi.Job, error)
	GetByStatus(status oapi.JobStatus) ([]*oapi.Job, error)
}

// UserApprovalRecordRepo defines the contract for user approval record storage.
type UserApprovalRecordRepo interface {
	Get(key string) (*oapi.UserApprovalRecord, bool)
	Set(entity *oapi.UserApprovalRecord) error
	Remove(key string) error
	Items() map[string]*oapi.UserApprovalRecord
	GetApprovedByVersionAndEnvironment(versionID, environmentID string) ([]*oapi.UserApprovalRecord, error)
}
