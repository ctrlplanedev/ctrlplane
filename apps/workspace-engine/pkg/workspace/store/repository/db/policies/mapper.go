package policies

import (
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func selectorFromString(s string) oapi.Selector {
	sel := oapi.Selector{}
	celJSON, _ := json.Marshal(oapi.CelSelector{Cel: s})
	_ = sel.UnmarshalJSON(celJSON)
	return sel
}

func selectorToString(sel oapi.Selector) string {
	cel, err := sel.AsCelSelector()
	if err == nil && cel.Cel != "" {
		return cel.Cel
	}
	return "false"
}

func pgtypeTextToPtr(t pgtype.Text) *string {
	if t.Valid {
		return &t.String
	}
	return nil
}

func pgtypeBoolToPtr(b pgtype.Bool) *bool {
	if b.Valid {
		return &b.Bool
	}
	return nil
}

func pgtypeInt4ToPtr(i pgtype.Int4) *int32 {
	if i.Valid {
		return &i.Int32
	}
	return nil
}

func pgtypeFloat4ToPtr(f pgtype.Float4) *float32 {
	if f.Valid {
		return &f.Float32
	}
	return nil
}

func stringsToJobStatuses(ss []string) *[]oapi.JobStatus {
	if len(ss) == 0 {
		return nil
	}
	statuses := make([]oapi.JobStatus, len(ss))
	for i, s := range ss {
		statuses[i] = oapi.JobStatus(s)
	}
	return &statuses
}

func PolicyToOapi(row db.Policy, rules RuleRows) *oapi.Policy {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	metadata := row.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	policyRules := make([]oapi.PolicyRule, 0)

	for _, r := range rules.AnyApproval {
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			AnyApproval: &oapi.AnyApprovalRule{
				MinApprovals: r.MinApprovals,
			},
		})
	}

	for _, r := range rules.DeploymentDependency {
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			DeploymentDependency: &oapi.DeploymentDependencyRule{
				DependsOn: r.DependsOn,
			},
		})
	}

	for _, r := range rules.DeploymentWindow {
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			DeploymentWindow: &oapi.DeploymentWindowRule{
				AllowWindow:     pgtypeBoolToPtr(r.AllowWindow),
				DurationMinutes: r.DurationMinutes,
				Rrule:           r.Rrule,
				Timezone:        pgtypeTextToPtr(r.Timezone),
			},
		})
	}

	for _, r := range rules.EnvironmentProgression {
		sel := selectorFromString(r.DependsOnEnvironmentSelector)
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: sel,
				MaximumAgeHours:              pgtypeInt4ToPtr(r.MaximumAgeHours),
				MinimumSockTimeMinutes:       pgtypeInt4ToPtr(r.MinimumSoakTimeMinutes),
				MinimumSuccessPercentage:     pgtypeFloat4ToPtr(r.MinimumSuccessPercentage),
				SuccessStatuses:              stringsToJobStatuses(r.SuccessStatuses),
			},
		})
	}

	for _, r := range rules.GradualRollout {
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			GradualRollout: &oapi.GradualRolloutRule{
				RolloutType:       oapi.GradualRolloutRuleRolloutType(r.RolloutType),
				TimeScaleInterval: r.TimeScaleInterval,
			},
		})
	}

	for _, r := range rules.Retry {
		var backoffStrategy *oapi.RetryRuleBackoffStrategy
		if r.BackoffStrategy.Valid {
			bs := oapi.RetryRuleBackoffStrategy(r.BackoffStrategy.String)
			backoffStrategy = &bs
		}
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			Retry: &oapi.RetryRule{
				MaxRetries:        r.MaxRetries,
				BackoffSeconds:    pgtypeInt4ToPtr(r.BackoffSeconds),
				BackoffStrategy:   backoffStrategy,
				MaxBackoffSeconds: pgtypeInt4ToPtr(r.MaxBackoffSeconds),
				RetryOnStatuses:   stringsToJobStatuses(r.RetryOnStatuses),
			},
		})
	}

	for _, r := range rules.Rollback {
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			Rollback: &oapi.RollbackRule{
				OnJobStatuses:         stringsToJobStatuses(r.OnJobStatuses),
				OnVerificationFailure: pgtypeBoolToPtr(r.OnVerificationFailure),
			},
		})
	}

	for _, r := range rules.Verification {
		var metrics []oapi.VerificationMetricSpec
		_ = json.Unmarshal(r.Metrics, &metrics)
		if metrics == nil {
			metrics = []oapi.VerificationMetricSpec{}
		}

		var triggerOn *oapi.VerificationRuleTriggerOn
		if r.TriggerOn.Valid {
			to := oapi.VerificationRuleTriggerOn(r.TriggerOn.String)
			triggerOn = &to
		}

		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			Verification: &oapi.VerificationRule{
				Metrics:   metrics,
				TriggerOn: triggerOn,
			},
		})
	}

	for _, r := range rules.VersionCooldown {
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: r.IntervalSeconds,
			},
		})
	}

	for _, r := range rules.VersionSelector {
		sel := selectorFromString(r.Selector)
		policyRules = append(policyRules, oapi.PolicyRule{
			Id:        r.ID.String(),
			PolicyId:  r.PolicyID.String(),
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
			VersionSelector: &oapi.VersionSelectorRule{
				Description: pgtypeTextToPtr(r.Description),
				Selector:    sel,
			},
		})
	}

	return &oapi.Policy{
		Id:          row.ID.String(),
		Name:        row.Name,
		Description: description,
		Selector:    row.Selector,
		Metadata:    metadata,
		Priority:    int(row.Priority),
		Enabled:     row.Enabled,
		WorkspaceId: row.WorkspaceID.String(),
		CreatedAt:   row.CreatedAt.Time.Format(time.RFC3339),
		Rules:       policyRules,
	}
}

func ToPolicyUpsertParams(p *oapi.Policy) (db.UpsertPolicyParams, error) {
	id, err := uuid.Parse(p.Id)
	if err != nil {
		return db.UpsertPolicyParams{}, fmt.Errorf("parse id: %w", err)
	}

	var description pgtype.Text
	if p.Description != nil {
		description = pgtype.Text{String: *p.Description, Valid: true}
	}

	metadata := p.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	var createdAt pgtype.Timestamptz
	if p.CreatedAt != "" {
		t, err := time.Parse(time.RFC3339, p.CreatedAt)
		if err != nil {
			return db.UpsertPolicyParams{}, fmt.Errorf("parse created_at: %w", err)
		}
		createdAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	return db.UpsertPolicyParams{
		ID:          id,
		Name:        p.Name,
		Description: description,
		Selector:    p.Selector,
		Metadata:    metadata,
		Priority:    int32(p.Priority),
		Enabled:     p.Enabled,
		WorkspaceID: uuid.Nil,
		CreatedAt:   createdAt,
	}, nil
}
