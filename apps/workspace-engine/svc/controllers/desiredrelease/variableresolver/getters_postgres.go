package variableresolver

import (
	"context"
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
	vars, err := q.ListDeploymentVariablesByDeploymentID(ctx, deploymentIDUUID)
	if err != nil {
		return nil, fmt.Errorf("list deployment variables for %s: %w", deploymentID, err)
	}

	result := make([]oapi.DeploymentVariableWithValues, 0, len(vars))
	for _, v := range vars {
		values, err := q.ListDeploymentVariableValuesByVariableID(ctx, v.ID)
		if err != nil {
			return nil, fmt.Errorf("list values for variable %s: %w", v.ID, err)
		}

		oapiValues := make([]oapi.DeploymentVariableValue, 0, len(values))
		for _, val := range values {
			oapiValues = append(oapiValues, db.ToOapiDeploymentVariableValue(val))
		}

		result = append(result, oapi.DeploymentVariableWithValues{
			Variable: db.ToOapiDeploymentVariable(v),
			Values:   oapiValues,
		})
	}
	return result, nil
}

func (g *PostgresGetter) GetResourceVariables(
	ctx context.Context,
	resourceID string,
) (map[string]oapi.ResourceVariable, error) {
	resourceIDUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	rows, err := db.GetQueries(ctx).ListResourceVariablesByResourceID(ctx, resourceIDUUID)
	if err != nil {
		return nil, fmt.Errorf("list resource variables for %s: %w", resourceID, err)
	}

	result := make(map[string]oapi.ResourceVariable, len(rows))
	for _, row := range rows {
		result[row.Key] = db.ToOapiResourceVariable(row)
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
		candidates := make([]eval.EntityData, 0, len(rows))
		for _, r := range rows {
			candidates = append(candidates, eval.EntityData{
				ID:          r.ID,
				WorkspaceID: r.WorkspaceID,
				EntityType:  "resource",
				Raw:         resourceRowToMap(r),
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
		return &eval.EntityData{
			ID:          r.ID,
			WorkspaceID: r.WorkspaceID,
			EntityType:  "resource",
			Raw:         resourceRowToMap(db.ListActiveResourcesByWorkspaceRow(r)),
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

func resourceRowToMap(r db.ListActiveResourcesByWorkspaceRow) map[string]any {
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
	return m
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
