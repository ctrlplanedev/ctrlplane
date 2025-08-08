package rules

import (
	"context"
	"time"

	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

// SelectorBasedRuleEngine integrates with the existing selector engine system
type SelectorBasedRuleEngine interface {
	RuleEngine

	// EvaluateReleaseTarget evaluates policies for a specific release target
	EvaluateReleaseTarget(ctx context.Context, target policy.ReleaseTarget) (*RuleEvaluationResult, error)

	// EvaluateReleaseTargets evaluates policies for multiple release targets
	EvaluateReleaseTargets(ctx context.Context, targets []policy.ReleaseTarget) (map[string]*RuleEvaluationResult, error)

	// GetPoliciesForReleaseTarget gets applicable policies for a release target
	GetPoliciesForReleaseTarget(ctx context.Context, target policy.ReleaseTarget) ([]PolicySelector, error)
}

// PolicyTargetMatcher integrates with the selector engine to match policies to targets
type PolicyTargetMatcher interface {
	// MatchesPolicyTarget determines if a release target matches a policy target's conditions
	MatchesPolicyTarget(ctx context.Context, target policy.ReleaseTarget, policyTarget policy.PolicyTarget) (bool, error)

	// GetMatchingPolicyTargets returns policy targets that match the given release target
	GetMatchingPolicyTargets(ctx context.Context, target policy.ReleaseTarget) ([]policy.PolicyTarget, error)

	// GetReleaseTargetsForPolicy returns release targets that match a policy's conditions
	GetReleaseTargetsForPolicy(ctx context.Context, policyTarget policy.PolicyTarget) ([]policy.ReleaseTarget, error)
}

// SelectorEngineRegistry provides access to the workspace selector engines
type SelectorEngineRegistry interface {
	// GetEnvironmentResourceEngine returns the environment-resource selector engine
	GetEnvironmentResourceEngine() selector.SelectorEngine[resource.Resource, environment.Environment]

	// GetDeploymentResourceEngine returns the deployment-resource selector engine
	GetDeploymentResourceEngine() selector.SelectorEngine[resource.Resource, deployment.Deployment]

	// GetPolicyTargetResourceEngine returns the policy target-resource selector engine
	GetPolicyTargetResourceEngine() selector.SelectorEngine[resource.Resource, policy.ReleaseTarget]

	// GetPolicyTargetEnvironmentEngine returns the policy target-environment selector engine
	GetPolicyTargetEnvironmentEngine() selector.SelectorEngine[environment.Environment, policy.ReleaseTarget]

	// GetPolicyTargetDeploymentEngine returns the policy target-deployment selector engine
	GetPolicyTargetDeploymentEngine() selector.SelectorEngine[deployment.Deployment, policy.ReleaseTarget]

	// GetPolicyTargetReleaseTargetEngine returns the policy target-release target selector engine
	GetPolicyTargetReleaseTargetEngine() selector.SelectorEngine[policy.ReleaseTarget, policy.ReleaseTarget]
}

// ReleaseTargetRuleEngine specifically handles rule evaluation for release targets
type ReleaseTargetRuleEngine interface {
	// CanDeployReleaseTarget determines if a release target can be deployed
	CanDeployReleaseTarget(ctx context.Context, target policy.ReleaseTarget) (*RuleEvaluationResult, error)

	// ValidateReleaseTarget validates a release target against all applicable policies
	ValidateReleaseTarget(ctx context.Context, target policy.ReleaseTarget) (*RuleEvaluationResult, error)

	// GetBlockingPoliciesForReleaseTarget returns policies that would block deployment of the release target
	GetBlockingPoliciesForReleaseTarget(ctx context.Context, target policy.ReleaseTarget) ([]PolicySelector, error)

	// SimulateReleaseTargetDeployment simulates deployment of a release target
	SimulateReleaseTargetDeployment(ctx context.Context, target policy.ReleaseTarget) (*RuleEvaluationResult, error)
}

// PolicyChangeNotifier handles notifications when policies or their evaluations change
type PolicyChangeNotifier interface {
	// NotifyPolicyAdded notifies when a new policy is added
	NotifyPolicyAdded(ctx context.Context, policyTarget policy.PolicyTarget) error

	// NotifyPolicyRemoved notifies when a policy is removed
	NotifyPolicyRemoved(ctx context.Context, policyID string) error

	// NotifyPolicyUpdated notifies when a policy is updated
	NotifyPolicyUpdated(ctx context.Context, policyTarget policy.PolicyTarget) error

	// NotifyReleaseTargetChanged notifies when a release target changes
	NotifyReleaseTargetChanged(ctx context.Context, target policy.ReleaseTarget) error
}

// PolicySelector wraps ReleaseTargetConditions to satisfy SelectorEntity interface
type PolicySelector struct {
	policy.ReleaseTargetConditions
}

// GetID implements the SelectorEntity interface
func (p PolicySelector) GetID() string {
	return p.ID
}

// PolicyMatchChangeHandler handles changes in policy-target matches from the selector engine
type PolicyMatchChangeHandler interface {
	// HandlePolicyMatchAdded handles when a release target starts matching a policy
	HandlePolicyMatchAdded(ctx context.Context, change selector.MatchChange[policy.ReleaseTarget, PolicySelector]) error

	// HandlePolicyMatchRemoved handles when a release target stops matching a policy
	HandlePolicyMatchRemoved(ctx context.Context, change selector.MatchChange[policy.ReleaseTarget, PolicySelector]) error

	// ProcessPolicyMatchChanges processes a stream of policy match changes
	ProcessPolicyMatchChanges(ctx context.Context, changes <-chan selector.ChannelResult[policy.ReleaseTarget, PolicySelector]) error
}

// DeploymentGate represents a gate that can block or allow deployments
type DeploymentGate interface {
	// IsOpen returns true if the gate allows deployment
	IsOpen(ctx context.Context, target policy.ReleaseTarget) (bool, error)

	// GetGateStatus returns the current status of the gate
	GetGateStatus(ctx context.Context, target policy.ReleaseTarget) (*GateStatus, error)

	// OpenGate manually opens the gate
	OpenGate(ctx context.Context, target policy.ReleaseTarget, reason string) error

	// CloseGate manually closes the gate
	CloseGate(ctx context.Context, target policy.ReleaseTarget, reason string) error
}

// GateStatus represents the status of a deployment gate
type GateStatus struct {
	IsOpen       bool
	Reason       string
	LastModified time.Time
	ModifiedBy   string
	Metadata     map[string]interface{}
}

// ApprovalGate represents a gate that requires manual approval
type ApprovalGate interface {
	DeploymentGate

	// RequestApproval requests approval for deployment
	RequestApproval(ctx context.Context, target policy.ReleaseTarget, requester string) (*ApprovalRequest, error)

	// ApproveDeployment approves a deployment request
	ApproveDeployment(ctx context.Context, requestID string, approver string, comment string) error

	// RejectDeployment rejects a deployment request
	RejectDeployment(ctx context.Context, requestID string, approver string, comment string) error

	// GetPendingApprovals returns pending approval requests
	GetPendingApprovals(ctx context.Context, target policy.ReleaseTarget) ([]ApprovalRequest, error)
}

// ApprovalRequest represents a request for deployment approval
type ApprovalRequest struct {
	ID          string
	TargetID    string
	Requester   string
	RequestedAt time.Time
	Status      ApprovalStatus
	Comments    []ApprovalComment
	Metadata    map[string]interface{}
}

// ApprovalStatus represents the status of an approval request
type ApprovalStatus string

const (
	ApprovalStatusPending  ApprovalStatus = "pending"
	ApprovalStatusApproved ApprovalStatus = "approved"
	ApprovalStatusRejected ApprovalStatus = "rejected"
	ApprovalStatusExpired  ApprovalStatus = "expired"
)

// ApprovalComment represents a comment on an approval request
type ApprovalComment struct {
	Author    string
	Comment   string
	Timestamp time.Time
}

// ScheduleGate represents a gate that opens/closes based on schedule
type ScheduleGate interface {
	DeploymentGate

	// GetSchedule returns the deployment schedule
	GetSchedule(ctx context.Context) (*DeploymentSchedule, error)

	// SetSchedule sets the deployment schedule
	SetSchedule(ctx context.Context, schedule *DeploymentSchedule) error

	// IsScheduledDeploymentTime checks if current time is within deployment window
	IsScheduledDeploymentTime(ctx context.Context, target policy.ReleaseTarget) (bool, error)
}

// DeploymentSchedule represents a schedule for when deployments are allowed
type DeploymentSchedule struct {
	AllowedWindows []TimeWindow
	BlockedWindows []TimeWindow
	Timezone       string
	Metadata       map[string]interface{}
}

// TimeWindow represents a time window for deployments
type TimeWindow struct {
	StartTime string         // e.g., "09:00" or "2023-01-01T09:00:00Z"
	EndTime   string         // e.g., "17:00" or "2023-01-01T17:00:00Z"
	Days      []time.Weekday // Days of week, empty means all days
	Recurring bool           // Whether this window repeats
}
