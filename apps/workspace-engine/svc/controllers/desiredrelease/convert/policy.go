package convert

import (
	"encoding/json"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type rawAnyApproval struct {
	ID           string `json:"id"`
	PolicyID     string `json:"policy_id"`
	MinApprovals int32  `json:"min_approvals"`
	CreatedAt    string `json:"created_at"`
}

type rawDeploymentDependency struct {
	ID        string `json:"id"`
	PolicyID  string `json:"policy_id"`
	DependsOn string `json:"depends_on"`
	CreatedAt string `json:"created_at"`
}

type rawDeploymentWindow struct {
	ID              string  `json:"id"`
	PolicyID        string  `json:"policy_id"`
	AllowWindow     *bool   `json:"allow_window"`
	DurationMinutes int32   `json:"duration_minutes"`
	Rrule           string  `json:"rrule"`
	Timezone        *string `json:"timezone"`
	CreatedAt       string  `json:"created_at"`
}

type rawEnvironmentProgression struct {
	ID                           string    `json:"id"`
	PolicyID                     string    `json:"policy_id"`
	DependsOnEnvironmentSelector string    `json:"depends_on_environment_selector"`
	MaximumAgeHours              *int32    `json:"maximum_age_hours"`
	MinimumSoakTimeMinutes       *int32    `json:"minimum_soak_time_minutes"`
	MinimumSuccessPercentage     *float32  `json:"minimum_success_percentage"`
	SuccessStatuses              *[]string `json:"success_statuses"`
	CreatedAt                    string    `json:"created_at"`
}

type rawGradualRollout struct {
	ID                string `json:"id"`
	PolicyID          string `json:"policy_id"`
	RolloutType       string `json:"rollout_type"`
	TimeScaleInterval int32  `json:"time_scale_interval"`
	CreatedAt         string `json:"created_at"`
}

type rawRetry struct {
	ID                string    `json:"id"`
	PolicyID          string    `json:"policy_id"`
	MaxRetries        int32     `json:"max_retries"`
	BackoffSeconds    *int32    `json:"backoff_seconds"`
	BackoffStrategy   *string   `json:"backoff_strategy"`
	MaxBackoffSeconds *int32    `json:"max_backoff_seconds"`
	RetryOnStatuses   *[]string `json:"retry_on_statuses"`
	CreatedAt         string    `json:"created_at"`
}

type rawRollback struct {
	ID                    string    `json:"id"`
	PolicyID              string    `json:"policy_id"`
	OnJobStatuses         *[]string `json:"on_job_statuses"`
	OnVerificationFailure *bool     `json:"on_verification_failure"`
	CreatedAt             string    `json:"created_at"`
}

type rawVerification struct {
	ID        string          `json:"id"`
	PolicyID  string          `json:"policy_id"`
	Metrics   json.RawMessage `json:"metrics"`
	TriggerOn *string         `json:"trigger_on"`
	CreatedAt string          `json:"created_at"`
}

type rawVersionCooldown struct {
	ID              string `json:"id"`
	PolicyID        string `json:"policy_id"`
	IntervalSeconds int32  `json:"interval_seconds"`
	CreatedAt       string `json:"created_at"`
}

type rawVersionSelector struct {
	ID          string  `json:"id"`
	PolicyID    string  `json:"policy_id"`
	Description *string `json:"description"`
	Selector    string  `json:"selector"`
	CreatedAt   string  `json:"created_at"`
}

func celSelector(expr string) oapi.Selector {
	var s oapi.Selector
	_ = s.FromCelSelector(oapi.CelSelector{Cel: expr})
	return s
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}

func PolicyWithRules(row db.ListPoliciesWithRulesByWorkspaceIDRow) (*oapi.Policy, error) {
	p := &oapi.Policy{
		Id:          row.ID.String(),
		Name:        row.Name,
		Selector:    row.Selector,
		Metadata:    row.Metadata,
		Priority:    int(row.Priority),
		Enabled:     row.Enabled,
		WorkspaceId: row.WorkspaceID.String(),
	}
	if row.Description.Valid {
		p.Description = &row.Description.String
	}
	if row.CreatedAt.Valid {
		p.CreatedAt = formatTime(row.CreatedAt.Time)
	}

	rules, err := parseAllRules(row)
	if err != nil {
		return nil, err
	}
	p.Rules = rules
	return p, nil
}

func parseAllRules(row db.ListPoliciesWithRulesByWorkspaceIDRow) ([]oapi.PolicyRule, error) {
	var rules []oapi.PolicyRule

	anyApprovals, err := parseAnyApprovalRules(row.AnyApprovalRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, anyApprovals...)

	depDeps, err := parseDeploymentDependencyRules(row.DeploymentDependencyRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, depDeps...)

	windows, err := parseDeploymentWindowRules(row.DeploymentWindowRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, windows...)

	envProgs, err := parseEnvironmentProgressionRules(row.EnvironmentProgressionRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, envProgs...)

	graduals, err := parseGradualRolloutRules(row.GradualRolloutRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, graduals...)

	retries, err := parseRetryRules(row.RetryRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, retries...)

	rollbacks, err := parseRollbackRules(row.RollbackRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, rollbacks...)

	verifications, err := parseVerificationRules(row.VerificationRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, verifications...)

	cooldowns, err := parseVersionCooldownRules(row.VersionCooldownRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, cooldowns...)

	versionSelectors, err := parseVersionSelectorRules(row.VersionSelectorRules)
	if err != nil {
		return nil, err
	}
	rules = append(rules, versionSelectors...)

	return rules, nil
}

func parseAnyApprovalRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawAnyApproval
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			AnyApproval: &oapi.AnyApprovalRule{
				MinApprovals: r.MinApprovals,
			},
		}
	}
	return rules, nil
}

func parseDeploymentDependencyRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawDeploymentDependency
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			DeploymentDependency: &oapi.DeploymentDependencyRule{
				DependsOn: r.DependsOn,
			},
		}
	}
	return rules, nil
}

func parseDeploymentWindowRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawDeploymentWindow
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			DeploymentWindow: &oapi.DeploymentWindowRule{
				AllowWindow:     r.AllowWindow,
				DurationMinutes: r.DurationMinutes,
				Rrule:           r.Rrule,
				Timezone:        r.Timezone,
			},
		}
	}
	return rules, nil
}

func parseEnvironmentProgressionRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawEnvironmentProgression
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rule := oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: celSelector(r.DependsOnEnvironmentSelector),
			MaximumAgeHours:              r.MaximumAgeHours,
			MinimumSockTimeMinutes:       r.MinimumSoakTimeMinutes,
			MinimumSuccessPercentage:     r.MinimumSuccessPercentage,
		}
		if r.SuccessStatuses != nil {
			statuses := make([]oapi.JobStatus, len(*r.SuccessStatuses))
			for j, s := range *r.SuccessStatuses {
				statuses[j] = oapi.JobStatus(s)
			}
			rule.SuccessStatuses = &statuses
		}
		rules[i] = oapi.PolicyRule{
			Id:                     r.ID,
			PolicyId:               r.PolicyID,
			CreatedAt:              r.CreatedAt,
			EnvironmentProgression: &rule,
		}
	}
	return rules, nil
}

func parseGradualRolloutRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawGradualRollout
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			GradualRollout: &oapi.GradualRolloutRule{
				RolloutType:       oapi.GradualRolloutRuleRolloutType(r.RolloutType),
				TimeScaleInterval: r.TimeScaleInterval,
			},
		}
	}
	return rules, nil
}

func parseRetryRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawRetry
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rule := oapi.RetryRule{
			MaxRetries:        r.MaxRetries,
			BackoffSeconds:    r.BackoffSeconds,
			MaxBackoffSeconds: r.MaxBackoffSeconds,
		}
		if r.BackoffStrategy != nil {
			bs := oapi.RetryRuleBackoffStrategy(*r.BackoffStrategy)
			rule.BackoffStrategy = &bs
		}
		if r.RetryOnStatuses != nil {
			statuses := make([]oapi.JobStatus, len(*r.RetryOnStatuses))
			for j, s := range *r.RetryOnStatuses {
				statuses[j] = oapi.JobStatus(s)
			}
			rule.RetryOnStatuses = &statuses
		}
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			Retry:     &rule,
		}
	}
	return rules, nil
}

func parseRollbackRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawRollback
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rule := oapi.RollbackRule{
			OnVerificationFailure: r.OnVerificationFailure,
		}
		if r.OnJobStatuses != nil {
			statuses := make([]oapi.JobStatus, len(*r.OnJobStatuses))
			for j, s := range *r.OnJobStatuses {
				statuses[j] = oapi.JobStatus(s)
			}
			rule.OnJobStatuses = &statuses
		}
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			Rollback:  &rule,
		}
	}
	return rules, nil
}

func parseVerificationRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawVerification
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rule := oapi.VerificationRule{}
		if r.Metrics != nil {
			var metrics []oapi.VerificationMetricSpec
			if err := json.Unmarshal(r.Metrics, &metrics); err != nil {
				return nil, err
			}
			rule.Metrics = metrics
		}
		if r.TriggerOn != nil {
			t := oapi.VerificationRuleTriggerOn(*r.TriggerOn)
			rule.TriggerOn = &t
		}
		rules[i] = oapi.PolicyRule{
			Id:           r.ID,
			PolicyId:     r.PolicyID,
			CreatedAt:    r.CreatedAt,
			Verification: &rule,
		}
	}
	return rules, nil
}

func parseVersionCooldownRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawVersionCooldown
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: r.IntervalSeconds,
			},
		}
	}
	return rules, nil
}

func parseVersionSelectorRules(data []byte) ([]oapi.PolicyRule, error) {
	var raw []rawVersionSelector
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	rules := make([]oapi.PolicyRule, len(raw))
	for i, r := range raw {
		rules[i] = oapi.PolicyRule{
			Id:        r.ID,
			PolicyId:  r.PolicyID,
			CreatedAt: r.CreatedAt,
			VersionSelector: &oapi.VersionSelectorRule{
				Description: r.Description,
				Selector:    celSelector(r.Selector),
			},
		}
	}
	return rules, nil
}
