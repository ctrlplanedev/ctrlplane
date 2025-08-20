package job

import "time"

type JobStatus string

const (
	JobStatusPending             JobStatus = "pending"
	JobStatusSkipped             JobStatus = "skipped"
	JobStatusInProgress          JobStatus = "in_progress"
	JobStatusActionRequired      JobStatus = "action_required"
	JobStatusCancelled           JobStatus = "cancelled"
	JobStatusFailure             JobStatus = "failure"
	JobStatusInvalidJobAgent     JobStatus = "invalid_job_agent"
	JobStatusInvalidIntegration  JobStatus = "invalid_integration"
	JobStatusExternalRunNotFound JobStatus = "external_run_not_found"
	JobStatusSuccessful          JobStatus = "successful"
)

type JobReason string

const (
	JobReasonPolicyPassing        JobReason = "policy_passing"
	JobReasonPolicyOverride       JobReason = "policy_override"
	JobReasonEnvPolicyOverride    JobReason = "env_policy_override"
	JobReasonConfigPolicyOverride JobReason = "config_policy_override"
)

type Job struct {
	ID string `json:"id"`

	JobAgentID     *string        `json:"jobAgentId,omitempty"`
	JobAgentConfig map[string]any `json:"jobAgentConfig"`

	ExternalID *string `json:"externalId,omitempty"`

	Status  JobStatus `json:"status"`
	Reason  JobReason `json:"reason"`
	Message *string   `json:"message,omitempty"`

	CreatedAt   time.Time `json:"createdAt"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (j Job) GetID() string {
	return j.ID
}

func (j Job) GetStatus() JobStatus {
	return j.Status
}

func (j Job) GetReason() JobReason {
	return j.Reason
}

func (j Job) GetMessage() *string {
	return j.Message
}

func (j Job) GetCreatedAt() time.Time {

	return j.CreatedAt
}

func (j Job) GetStartedAt() time.Time {
	return j.StartedAt
}

func (j Job) GetCompletedAt() time.Time {
	return j.CompletedAt
}

func (j Job) GetUpdatedAt() time.Time {
	return j.UpdatedAt
}

func (j Job) GetJobAgentID() *string {
	return j.JobAgentID
}

func (j Job) GetJobAgentConfig() map[string]any {
	return j.JobAgentConfig
}

func (j Job) GetExternalID() *string {
	return j.ExternalID
}

func (j Job) IsInProgress() bool {
	return j.Status == JobStatusInProgress || j.Status == JobStatusActionRequired
}

func (j Job) IsPending() bool {
	return j.Status == JobStatusPending
}

func (j Job) IsCompleted() bool {
	return j.Status == JobStatusSuccessful ||
		j.Status == JobStatusFailure ||
		j.Status == JobStatusCancelled ||
		j.Status == JobStatusSkipped ||
		j.Status == JobStatusInvalidJobAgent ||
		j.Status == JobStatusInvalidIntegration ||
		j.Status == JobStatusExternalRunNotFound
}

func (j Job) IsSuccessful() bool {
	return j.Status == JobStatusSuccessful
}

func (j Job) IsFailure() bool {
	return j.Status == JobStatusFailure ||
		j.Status == JobStatusExternalRunNotFound ||
		j.Status == JobStatusInvalidJobAgent ||
		j.Status == JobStatusInvalidIntegration
}
