package policies

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var policyRepoTracer = otel.Tracer("workspace/store/repository/db/policies")

type RuleRows struct {
	AnyApproval            []db.PolicyRuleAnyApproval
	DeploymentDependency   []db.PolicyRuleDeploymentDependency
	DeploymentWindow       []db.PolicyRuleDeploymentWindow
	EnvironmentProgression []db.PolicyRuleEnvironmentProgression
	GradualRollout         []db.PolicyRuleGradualRollout
	Retry                  []db.PolicyRuleRetry
	Rollback               []db.PolicyRuleRollback
	Verification           []db.PolicyRuleVerification
	VersionCooldown        []db.PolicyRuleVersionCooldown
	VersionSelector        []db.PolicyRuleVersionSelector
}

type Repo struct {
	ctx         context.Context
	workspaceID string
}

func NewRepo(ctx context.Context, workspaceID string) *Repo {
	return &Repo{ctx: ctx, workspaceID: workspaceID}
}

func (r *Repo) Get(id string) (*oapi.Policy, bool) {
	_, span := policyRepoTracer.Start(r.ctx, "PolicyRepo.Get")
	defer span.End()
	span.SetAttributes(attribute.String("policy_id", id))

	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse policy id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetPolicyByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	rules, err := r.loadRules(uid)
	if err != nil {
		log.Warn("Failed to load rules for policy", "policy_id", id, "error", err)
	}
	return PolicyToOapi(row, rules), true
}

func (r *Repo) Set(entity *oapi.Policy) error {
	_, span := policyRepoTracer.Start(r.ctx, "PolicyRepo.Set")
	defer span.End()
	span.SetAttributes(attribute.String("policy_id", entity.Id), attribute.Int("rule_count", len(entity.Rules)))
	params, err := ToPolicyUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	wsID, err := uuid.Parse(r.workspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace_id: %w", err)
	}
	params.WorkspaceID = wsID

	policyID, err := uuid.Parse(entity.Id)
	if err != nil {
		return fmt.Errorf("parse policy id: %w", err)
	}

	tx, err := db.GetPool(r.ctx).Begin(r.ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(r.ctx)

	q := db.New(tx)

	if _, err := q.UpsertPolicy(r.ctx, params); err != nil {
		return fmt.Errorf("upsert policy: %w", err)
	}

	if err := r.deleteAllRulesWithQueries(q, policyID); err != nil {
		return fmt.Errorf("delete existing rules: %w", err)
	}

	if err := r.insertRulesWithQueries(q, policyID, entity.Rules); err != nil {
		return fmt.Errorf("insert rules: %w", err)
	}

	return tx.Commit(r.ctx)
}

func (r *Repo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeletePolicy(r.ctx, uid)
}

func (r *Repo) Items() map[string]*oapi.Policy {
	_, span := policyRepoTracer.Start(r.ctx, "PolicyRepo.Items")
	defer span.End()

	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Policy)
	}

	rows, err := db.GetQueries(r.ctx).ListPoliciesByWorkspaceID(r.ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: uid,
	})
	if err != nil {
		log.Warn("Failed to list policies by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Policy)
	}

	span.SetAttributes(attribute.Int("policy_count", len(rows)))

	result := make(map[string]*oapi.Policy, len(rows))
	for _, row := range rows {
		rules, err := r.loadRules(row.ID)
		if err != nil {
			log.Warn("Failed to load rules for policy", "policy_id", row.ID, "error", err)
		}
		p := PolicyToOapi(row, rules)
		result[p.Id] = p
	}
	return result
}

func (r *Repo) loadRules(policyID uuid.UUID) (RuleRows, error) {
	_, span := policyRepoTracer.Start(r.ctx, "PolicyRepo.loadRules")
	defer span.End()
	span.SetAttributes(attribute.String("policy_id", policyID.String()))

	q := db.GetQueries(r.ctx)
	var rows RuleRows
	var errs []error

	if v, err := q.ListAnyApprovalRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("any_approval: %w", err))
	} else {
		rows.AnyApproval = v
	}
	if v, err := q.ListDeploymentDependencyRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("deployment_dependency: %w", err))
	} else {
		rows.DeploymentDependency = v
	}
	if v, err := q.ListDeploymentWindowRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("deployment_window: %w", err))
	} else {
		rows.DeploymentWindow = v
	}
	if v, err := q.ListEnvironmentProgressionRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("environment_progression: %w", err))
	} else {
		rows.EnvironmentProgression = v
	}
	if v, err := q.ListGradualRolloutRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("gradual_rollout: %w", err))
	} else {
		rows.GradualRollout = v
	}
	if v, err := q.ListRetryRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("retry: %w", err))
	} else {
		rows.Retry = v
	}
	if v, err := q.ListRollbackRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("rollback: %w", err))
	} else {
		rows.Rollback = v
	}
	if v, err := q.ListVerificationRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("verification: %w", err))
	} else {
		rows.Verification = v
	}
	if v, err := q.ListVersionCooldownRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("version_cooldown: %w", err))
	} else {
		rows.VersionCooldown = v
	}
	if v, err := q.ListVersionSelectorRulesByPolicyID(r.ctx, policyID); err != nil {
		errs = append(errs, fmt.Errorf("version_selector: %w", err))
	} else {
		rows.VersionSelector = v
	}

	if len(errs) > 0 {
		return rows, fmt.Errorf("failed to load rules for policy %s: %v", policyID, errs)
	}
	return rows, nil
}

func (r *Repo) deleteAllRulesWithQueries(q *db.Queries, policyID uuid.UUID) error {
	deleters := []func(context.Context, uuid.UUID) error{
		q.DeleteAnyApprovalRulesByPolicyID,
		q.DeleteDeploymentDependencyRulesByPolicyID,
		q.DeleteDeploymentWindowRulesByPolicyID,
		q.DeleteEnvironmentProgressionRulesByPolicyID,
		q.DeleteGradualRolloutRulesByPolicyID,
		q.DeleteRetryRulesByPolicyID,
		q.DeleteRollbackRulesByPolicyID,
		q.DeleteVerificationRulesByPolicyID,
		q.DeleteVersionCooldownRulesByPolicyID,
		q.DeleteVersionSelectorRulesByPolicyID,
	}
	for _, del := range deleters {
		if err := del(r.ctx, policyID); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repo) insertRulesWithQueries(q *db.Queries, policyID uuid.UUID, rules []oapi.PolicyRule) error {

	for _, rule := range rules {
		ruleID, err := uuid.Parse(rule.Id)
		if err != nil {
			return fmt.Errorf("parse rule id: %w", err)
		}
		createdAt := parseTimestamptz(rule.CreatedAt)

		if rule.AnyApproval != nil {
			if err := q.UpsertAnyApprovalRule(r.ctx, db.UpsertAnyApprovalRuleParams{
				ID:           ruleID,
				PolicyID:     policyID,
				MinApprovals: rule.AnyApproval.MinApprovals,
				CreatedAt:    createdAt,
			}); err != nil {
				return fmt.Errorf("upsert any_approval rule: %w", err)
			}
		}

		if rule.DeploymentDependency != nil {
			if err := q.UpsertDeploymentDependencyRule(r.ctx, db.UpsertDeploymentDependencyRuleParams{
				ID:        ruleID,
				PolicyID:  policyID,
				DependsOn: rule.DeploymentDependency.DependsOn,
				CreatedAt: createdAt,
			}); err != nil {
				return fmt.Errorf("upsert deployment_dependency rule: %w", err)
			}
		}

		if rule.DeploymentWindow != nil {
			if err := q.UpsertDeploymentWindowRule(r.ctx, db.UpsertDeploymentWindowRuleParams{
				ID:              ruleID,
				PolicyID:        policyID,
				AllowWindow:     optBoolToPgtype(rule.DeploymentWindow.AllowWindow),
				DurationMinutes: rule.DeploymentWindow.DurationMinutes,
				Rrule:           rule.DeploymentWindow.Rrule,
				Timezone:        optStringToPgtext(rule.DeploymentWindow.Timezone),
				CreatedAt:       createdAt,
			}); err != nil {
				return fmt.Errorf("upsert deployment_window rule: %w", err)
			}
		}

		if rule.EnvironmentProgression != nil {
			ep := rule.EnvironmentProgression
			var successStatuses []string
			if ep.SuccessStatuses != nil {
				for _, s := range *ep.SuccessStatuses {
					successStatuses = append(successStatuses, string(s))
				}
			}
			if err := q.UpsertEnvironmentProgressionRule(r.ctx, db.UpsertEnvironmentProgressionRuleParams{
				ID:                           ruleID,
				PolicyID:                     policyID,
				DependsOnEnvironmentSelector: selectorToString(ep.DependsOnEnvironmentSelector),
				MaximumAgeHours:              optInt32ToPgint4(ep.MaximumAgeHours),
				MinimumSoakTimeMinutes:       optInt32ToPgint4(ep.MinimumSockTimeMinutes),
				MinimumSuccessPercentage:     optFloat32ToPgfloat4(ep.MinimumSuccessPercentage),
				SuccessStatuses:              successStatuses,
				CreatedAt:                    createdAt,
			}); err != nil {
				return fmt.Errorf("upsert environment_progression rule: %w", err)
			}
		}

		if rule.GradualRollout != nil {
			if err := q.UpsertGradualRolloutRule(r.ctx, db.UpsertGradualRolloutRuleParams{
				ID:                ruleID,
				PolicyID:          policyID,
				RolloutType:       string(rule.GradualRollout.RolloutType),
				TimeScaleInterval: rule.GradualRollout.TimeScaleInterval,
				CreatedAt:         createdAt,
			}); err != nil {
				return fmt.Errorf("upsert gradual_rollout rule: %w", err)
			}
		}

		if rule.Retry != nil {
			rt := rule.Retry
			var retryOnStatuses []string
			if rt.RetryOnStatuses != nil {
				for _, s := range *rt.RetryOnStatuses {
					retryOnStatuses = append(retryOnStatuses, string(s))
				}
			}
			var backoffStrategy pgtype.Text
			if rt.BackoffStrategy != nil {
				backoffStrategy = pgtype.Text{String: string(*rt.BackoffStrategy), Valid: true}
			}
			if err := q.UpsertRetryRule(r.ctx, db.UpsertRetryRuleParams{
				ID:                ruleID,
				PolicyID:          policyID,
				MaxRetries:        rt.MaxRetries,
				BackoffSeconds:    optInt32ToPgint4(rt.BackoffSeconds),
				BackoffStrategy:   backoffStrategy,
				MaxBackoffSeconds: optInt32ToPgint4(rt.MaxBackoffSeconds),
				RetryOnStatuses:   retryOnStatuses,
				CreatedAt:         createdAt,
			}); err != nil {
				return fmt.Errorf("upsert retry rule: %w", err)
			}
		}

		if rule.Rollback != nil {
			rb := rule.Rollback
			var onJobStatuses []string
			if rb.OnJobStatuses != nil {
				for _, s := range *rb.OnJobStatuses {
					onJobStatuses = append(onJobStatuses, string(s))
				}
			}
			if err := q.UpsertRollbackRule(r.ctx, db.UpsertRollbackRuleParams{
				ID:                    ruleID,
				PolicyID:              policyID,
				OnJobStatuses:         onJobStatuses,
				OnVerificationFailure: optBoolToPgtype(rb.OnVerificationFailure),
				CreatedAt:             createdAt,
			}); err != nil {
				return fmt.Errorf("upsert rollback rule: %w", err)
			}
		}

		if rule.Verification != nil {
			vr := rule.Verification
			metricsJSON, err := json.Marshal(vr.Metrics)
			if err != nil {
				return fmt.Errorf("marshal verification metrics: %w", err)
			}
			var triggerOn pgtype.Text
			if vr.TriggerOn != nil {
				triggerOn = pgtype.Text{String: string(*vr.TriggerOn), Valid: true}
			}
			if err := q.UpsertVerificationRule(r.ctx, db.UpsertVerificationRuleParams{
				ID:        ruleID,
				PolicyID:  policyID,
				Metrics:   metricsJSON,
				TriggerOn: triggerOn,
				CreatedAt: createdAt,
			}); err != nil {
				return fmt.Errorf("upsert verification rule: %w", err)
			}
		}

		if rule.VersionCooldown != nil {
			if err := q.UpsertVersionCooldownRule(r.ctx, db.UpsertVersionCooldownRuleParams{
				ID:              ruleID,
				PolicyID:        policyID,
				IntervalSeconds: rule.VersionCooldown.IntervalSeconds,
				CreatedAt:       createdAt,
			}); err != nil {
				return fmt.Errorf("upsert version_cooldown rule: %w", err)
			}
		}

		if rule.VersionSelector != nil {
			vs := rule.VersionSelector
			if err := q.UpsertVersionSelectorRule(r.ctx, db.UpsertVersionSelectorRuleParams{
				ID:          ruleID,
				PolicyID:    policyID,
				Description: optStringToPgtext(vs.Description),
				Selector:    selectorToString(vs.Selector),
				CreatedAt:   createdAt,
			}); err != nil {
				return fmt.Errorf("upsert version_selector rule: %w", err)
			}
		}
	}

	return nil
}

func parseTimestamptz(s string) pgtype.Timestamptz {
	if s == "" {
		return pgtype.Timestamptz{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func optBoolToPgtype(b *bool) pgtype.Bool {
	if b == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *b, Valid: true}
}

func optStringToPgtext(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func optInt32ToPgint4(v *int32) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *v, Valid: true}
}

func optFloat32ToPgfloat4(v *float32) pgtype.Float4 {
	if v == nil {
		return pgtype.Float4{}
	}
	return pgtype.Float4{Float32: *v, Valid: true}
}
