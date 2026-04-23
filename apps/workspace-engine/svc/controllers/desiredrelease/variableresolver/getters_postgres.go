package variableresolver

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"
)

var _ Getter = (*PostgresGetter)(nil)

func NewPostgresGetter(queries *db.Queries) Getter {
	return &PostgresGetter{
		queries: queries,
	}
}

type PostgresGetter struct {
	queries *db.Queries
}

func (g *PostgresGetter) GetCandidateVersions(
	ctx context.Context,
	deploymentID uuid.UUID,
) ([]*oapi.DeploymentVersion, error) {
	rows, err := db.GetQueries(ctx).
		ListDeployableVersionsByDeploymentID(ctx, db.ListDeployableVersionsByDeploymentIDParams{
			DeploymentID: deploymentID,
			Limit:        pgtype.Int4{Int32: 500, Valid: true},
		})
	if err != nil {
		return nil, fmt.Errorf("list versions for deployment %s: %w", deploymentID, err)
	}

	versions := make([]*oapi.DeploymentVersion, 0, len(rows))
	for _, row := range rows {
		versions = append(versions, db.ToOapiDeploymentVersion(row))
	}
	return versions, nil
}

func (g *PostgresGetter) GetApprovalRecords(
	ctx context.Context,
	versionID, environmentID string,
) ([]*oapi.UserApprovalRecord, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	approvalRecords, err := db.GetQueries(ctx).
		ListApprovedRecordsByVersionAndEnvironment(ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
			VersionID:     versionIDUUID,
			EnvironmentID: environmentIDUUID,
		})
	if err != nil {
		return nil, fmt.Errorf("list approval records for workspace %s: %w", versionID, err)
	}
	approvalRecordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(approvalRecords))
	for _, approvalRecord := range approvalRecords {
		approvalRecordsOAPI = append(
			approvalRecordsOAPI,
			db.ToOapiUserApprovalRecord(approvalRecord),
		)
	}
	return approvalRecordsOAPI, nil
}

func (g *PostgresGetter) GetPolicySkips(
	ctx context.Context,
	versionID, environmentID, resourceID string,
) ([]*oapi.PolicySkip, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	resourceIDUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	policySkips, err := db.GetQueries(ctx).
		ListPolicySkipsForTarget(ctx, db.ListPolicySkipsForTargetParams{
			VersionID:     versionIDUUID,
			EnvironmentID: environmentIDUUID,
			ResourceID:    resourceIDUUID,
		})
	if err != nil {
		return nil, fmt.Errorf("list policy skips for version %s: %w", versionID, err)
	}
	result := make([]*oapi.PolicySkip, 0, len(policySkips))
	for _, skip := range policySkips {
		result = append(result, db.ToOapiPolicySkip(skip))
	}
	return result, nil
}

func (g *PostgresGetter) GetDeploymentVariables(
	ctx context.Context,
	deploymentID string,
) ([]oapi.DeploymentVariableWithValues, error) {
	q := db.GetQueries(ctx)

	deploymentIDUUID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	rows, err := q.ListVariablesWithValuesByDeploymentID(ctx, deploymentIDUUID)
	if err != nil {
		return nil, fmt.Errorf("list deployment variables for %s: %w", deploymentID, err)
	}

	result := make([]oapi.DeploymentVariableWithValues, 0, len(rows))
	for _, row := range rows {
		var aggs []db.VariableValueAggRow
		if err := json.Unmarshal(row.Values, &aggs); err != nil {
			return nil, fmt.Errorf("unmarshal values for variable %s: %w", row.ID, err)
		}

		oapiValues := make([]oapi.DeploymentVariableValue, 0, len(aggs))
		for _, a := range aggs {
			val, err := db.ToOapiDeploymentVariableValueFromAgg(a)
			if err != nil {
				return nil, fmt.Errorf("map value %s: %w", a.ID, err)
			}
			oapiValues = append(oapiValues, val)
		}

		result = append(result, oapi.DeploymentVariableWithValues{
			Variable: db.ToOapiDeploymentVariable(row),
			Values:   oapiValues,
		})
	}
	return result, nil
}

func (g *PostgresGetter) GetResourceVariables(
	ctx context.Context,
	resourceID string,
) (map[string][]oapi.ResourceVariable, error) {
	resourceIDUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	rows, err := db.GetQueries(ctx).ListVariablesWithValuesByResourceID(ctx, resourceIDUUID)
	if err != nil {
		return nil, fmt.Errorf("list resource variables for %s: %w", resourceID, err)
	}

	result := make(map[string][]oapi.ResourceVariable, len(rows))
	for _, row := range rows {
		var aggs []db.VariableValueAggRow
		if err := json.Unmarshal(row.Values, &aggs); err != nil {
			return nil, fmt.Errorf("unmarshal values for variable %s: %w", row.ID, err)
		}
		rvs, err := db.ToOapiResourceVariablesFromAgg(row.ResourceID, row.Key, aggs)
		if err != nil {
			return nil, fmt.Errorf("map resource variable %s: %w", row.ID, err)
		}
		result[row.Key] = rvs
	}
	return result, nil
}

func (g *PostgresGetter) GetVariableSetsWithVariables(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]oapi.VariableSetWithVariables, error) {
	rows, err := db.GetQueries(ctx).ListVariableSetsWithVariablesByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf(
			"list variable sets with variables for workspace %s: %w",
			workspaceID,
			err,
		)
	}
	result := make([]oapi.VariableSetWithVariables, 0, len(rows))
	for _, row := range rows {
		result = append(result, db.ToOapiVariableSetWithVariables(row))
	}
	return result, nil
}

func (g *PostgresGetter) GetRelationshipRules(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]eval.Rule, error) {
	q := db.GetQueries(ctx)

	rows, err := q.GetRelationshipRulesForWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("get rules for workspace %s: %w", workspaceID, err)
	}

	rules := make([]eval.Rule, 0, len(rows))
	for _, row := range rows {
		rules = append(rules, eval.Rule{
			ID:        row.ID,
			Reference: row.Reference,
			Cel:       row.Cel,
		})
	}
	return rules, nil
}

func (g *PostgresGetter) LoadCandidates(
	ctx context.Context,
	workspaceID uuid.UUID,
	entityType string,
) ([]eval.EntityData, error) {
	q := db.GetQueries(ctx)

	switch entityType {
	case "resource":
		rows, err := q.ListActiveResourcesByWorkspace(ctx, workspaceID)
		if err != nil {
			return nil, fmt.Errorf("list resources for workspace %s: %w", workspaceID, err)
		}
		varsByResource, err := loadResourceVariablesByWorkspace(ctx, q, workspaceID)
		if err != nil {
			return nil, err
		}
		candidates := make([]eval.EntityData, 0, len(rows))
		for _, r := range rows {
			candidates = append(candidates, eval.EntityData{
				ID:          r.ID,
				WorkspaceID: r.WorkspaceID,
				EntityType:  "resource",
				Raw:         resourceRowToMap(r, varsByResource[r.ID]),
			})
		}
		return candidates, nil

	case "deployment":
		rows, err := q.ListDeploymentsByWorkspace(ctx, workspaceID)
		if err != nil {
			return nil, fmt.Errorf("list deployments for workspace %s: %w", workspaceID, err)
		}
		candidates := make([]eval.EntityData, 0, len(rows))
		for _, r := range rows {
			candidates = append(candidates, eval.EntityData{
				ID:          r.ID,
				WorkspaceID: r.WorkspaceID,
				EntityType:  "deployment",
				Raw:         deploymentRowToMap(r),
			})
		}
		return candidates, nil

	case "environment":
		rows, err := q.ListEnvironmentsByWorkspace(ctx, workspaceID)
		if err != nil {
			return nil, fmt.Errorf("list environments for workspace %s: %w", workspaceID, err)
		}
		candidates := make([]eval.EntityData, 0, len(rows))
		for _, r := range rows {
			candidates = append(candidates, eval.EntityData{
				ID:          r.ID,
				WorkspaceID: r.WorkspaceID,
				EntityType:  "environment",
				Raw:         environmentRowToMap(r),
			})
		}
		return candidates, nil

	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}
}

func (g *PostgresGetter) GetEntityByID(
	ctx context.Context,
	entityID uuid.UUID,
	entityType string,
) (*eval.EntityData, error) {
	q := db.GetQueries(ctx)

	switch entityType {
	case "resource":
		r, err := q.GetActiveResourceByID(ctx, entityID)
		if err != nil {
			return nil, fmt.Errorf("get resource %s: %w", entityID, err)
		}
		vars, err := loadResourceVariables(ctx, q, r.ID)
		if err != nil {
			return nil, err
		}
		return &eval.EntityData{
			ID:          r.ID,
			WorkspaceID: r.WorkspaceID,
			EntityType:  "resource",
			Raw:         resourceRowToMap(db.ListActiveResourcesByWorkspaceRow(r), vars),
		}, nil

	case "deployment":
		r, err := q.GetDeploymentForRelEval(ctx, entityID)
		if err != nil {
			return nil, fmt.Errorf("get deployment %s: %w", entityID, err)
		}
		return &eval.EntityData{
			ID:          r.ID,
			WorkspaceID: r.WorkspaceID,
			EntityType:  "deployment",
			Raw:         deploymentRowToMap(db.ListDeploymentsByWorkspaceRow(r)),
		}, nil

	case "environment":
		r, err := q.GetEnvironmentForRelEval(ctx, entityID)
		if err != nil {
			return nil, fmt.Errorf("get environment %s: %w", entityID, err)
		}
		return &eval.EntityData{
			ID:          r.ID,
			WorkspaceID: r.WorkspaceID,
			EntityType:  "environment",
			Raw:         environmentRowToMap(db.ListEnvironmentsByWorkspaceRow(r)),
		}, nil

	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}
}

func resourceRowToMap(
	r db.ListActiveResourcesByWorkspaceRow,
	vars map[string]oapi.Value,
) map[string]any {
	m := map[string]any{
		"type":       "resource",
		"id":         r.ID.String(),
		"name":       r.Name,
		"kind":       r.Kind,
		"version":    r.Version,
		"identifier": r.Identifier,
		"config":     r.Config,
		"metadata":   stringMapToAnyMap(r.Metadata),
	}
	if r.ProviderID != uuid.Nil {
		m["providerId"] = r.ProviderID.String()
	}
	if len(vars) > 0 {
		m["variables"] = vars
	}
	return m
}

// effectiveValue picks the null-selector, highest-priority value for
// projecting a resource variable into the CEL evaluation context. Selector
// matching is not available here because the CEL context is built without a
// target resource.
//
// Returns (value, found, err):
//   - found=false, err=nil: no null-selector candidate exists (normal absence).
//   - found=false, err!=nil: a candidate was selected but conversion failed;
//     callers must propagate rather than silently drop.
func effectiveValue(aggs []db.VariableValueAggRow) (oapi.Value, bool, error) {
	var best *db.VariableValueAggRow
	for i := range aggs {
		a := &aggs[i]
		if a.ResourceSelector != nil && *a.ResourceSelector != "" {
			continue
		}
		if best == nil || a.Priority > best.Priority {
			best = a
		}
	}
	if best == nil {
		return oapi.Value{}, false, nil
	}
	v, err := db.ToOapiDeploymentVariableValueFromAgg(*best)
	if err != nil {
		return oapi.Value{}, false, err
	}
	return v.Value, true, nil
}

func loadResourceVariables(
	ctx context.Context,
	q *db.Queries,
	resourceID uuid.UUID,
) (map[string]oapi.Value, error) {
	rows, err := q.ListVariablesWithValuesByResourceID(ctx, resourceID)
	if err != nil {
		return nil, fmt.Errorf("list variables for resource %s: %w", resourceID, err)
	}
	if len(rows) == 0 {
		return nil, nil
	}
	vars := make(map[string]oapi.Value, len(rows))
	for _, row := range rows {
		var aggs []db.VariableValueAggRow
		if err := json.Unmarshal(row.Values, &aggs); err != nil {
			return nil, fmt.Errorf("unmarshal values for variable %s: %w", row.ID, err)
		}
		v, ok, err := effectiveValue(aggs)
		if err != nil {
			return nil, fmt.Errorf("effective value for variable %s: %w", row.ID, err)
		}
		if ok {
			vars[row.Key] = v
		}
	}
	return vars, nil
}

func loadResourceVariablesByWorkspace(
	ctx context.Context,
	q *db.Queries,
	workspaceID uuid.UUID,
) (map[uuid.UUID]map[string]oapi.Value, error) {
	rows, err := q.ListResourceVariablesWithValuesByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list variables for workspace %s: %w", workspaceID, err)
	}
	result := make(map[uuid.UUID]map[string]oapi.Value)
	for _, row := range rows {
		var aggs []db.VariableValueAggRow
		if err := json.Unmarshal(row.Values, &aggs); err != nil {
			return nil, fmt.Errorf("unmarshal values for variable %s: %w", row.ID, err)
		}
		v, ok, err := effectiveValue(aggs)
		if err != nil {
			return nil, fmt.Errorf("effective value for variable %s: %w", row.ID, err)
		}
		if !ok {
			continue
		}
		m := result[row.ResourceID]
		if m == nil {
			m = make(map[string]oapi.Value)
			result[row.ResourceID] = m
		}
		m[row.Key] = v
	}
	return result, nil
}

func deploymentRowToMap(r db.ListDeploymentsByWorkspaceRow) map[string]any {
	m := map[string]any{
		"type":     "deployment",
		"id":       r.ID.String(),
		"name":     r.Name,
		"metadata": stringMapToAnyMap(r.Metadata),
	}
	if r.Description != "" {
		m["description"] = r.Description
	}
	return m
}

func environmentRowToMap(r db.ListEnvironmentsByWorkspaceRow) map[string]any {
	m := map[string]any{
		"type":     "environment",
		"id":       r.ID.String(),
		"name":     r.Name,
		"metadata": stringMapToAnyMap(r.Metadata),
	}
	if r.Description.Valid {
		m["description"] = r.Description.String
	}
	return m
}

func stringMapToAnyMap(m map[string]string) map[string]any {
	if m == nil {
		return nil
	}
	result := make(map[string]any, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}
