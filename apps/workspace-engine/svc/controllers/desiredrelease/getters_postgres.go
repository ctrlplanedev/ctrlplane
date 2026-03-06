package desiredrelease

import (
	"context"
	"fmt"
	"regexp"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type PostgresGetter struct{}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error) {
	q := db.GetQueries(ctx)

	depRow, err := q.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", rt.DeploymentID, err)
	}

	envRow, err := q.GetEnvironmentByID(ctx, rt.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", rt.EnvironmentID, err)
	}

	resRow, err := q.GetResourceByID(ctx, rt.ResourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource %s: %w", rt.ResourceID, err)
	}

	return &evaluator.EvaluatorScope{
		Deployment:  db.ToOapiDeployment(depRow),
		Environment: db.ToOapiEnvironment(envRow),
		Resource:    db.ToOapiResource(resRow),
	}, nil
}

func (g *PostgresGetter) GetCandidateVersions(ctx context.Context, deploymentID uuid.UUID) ([]*oapi.DeploymentVersion, error) {
	rows, err := db.GetQueries(ctx).ListDeployableVersionsByDeploymentID(ctx, db.ListDeployableVersionsByDeploymentIDParams{
		DeploymentID: deploymentID,
		Limit:        pgtype.Int4{Int32: 5000, Valid: true},
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

func (g *PostgresGetter) GetPolicies(ctx context.Context, rt *ReleaseTarget) ([]*oapi.Policy, error) {
	policies, err := db.GetQueries(ctx).ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: rt.WorkspaceID,
		Limit:       pgtype.Int4{Int32: 5000, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("list policies for workspace %s: %w", rt.WorkspaceID, err)
	}
	policiesOAPI := make([]*oapi.Policy, 0, len(policies))
	for _, policy := range policies {
		policiesOAPI = append(policiesOAPI, db.ToOapiPolicy(policy))
	}
	return policiesOAPI, nil
}

func (g *PostgresGetter) GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	approvalRecords, err := db.GetQueries(ctx).ListApprovedRecordsByVersionAndEnvironment(ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
		VersionID:     uuid.MustParse(versionID),
		EnvironmentID: uuid.MustParse(environmentID),
	})
	if err != nil {
		return nil, fmt.Errorf("list approval records for workspace %s: %w", versionID, err)
	}
	approvalRecordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(approvalRecords))
	for _, approvalRecord := range approvalRecords {
		approvalRecordsOAPI = append(approvalRecordsOAPI, db.ToOapiUserApprovalRecord(approvalRecord))
	}
	return approvalRecordsOAPI, nil
}

func (g *PostgresGetter) GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error) {
	policySkips, err := db.GetQueries(ctx).ListPolicySkipsForTarget(ctx, db.ListPolicySkipsForTargetParams{
		VersionID:     uuid.MustParse(versionID),
		EnvironmentID: uuid.MustParse(environmentID),
		ResourceID:    uuid.MustParse(resourceID),
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

func (g *PostgresGetter) HasCurrentRelease(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	releases, err := db.GetQueries(ctx).ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    rt.ResourceID,
		EnvironmentID: rt.EnvironmentID,
		DeploymentID:  rt.DeploymentID,
	})
	if err != nil {
		return false, fmt.Errorf("list releases for release target: %w", err)
	}
	return len(releases) > 0, nil
}

func (g *PostgresGetter) GetCurrentRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error) {
	q := db.GetQueries(ctx)

	releases, err := q.ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    rt.ResourceID,
		EnvironmentID: rt.EnvironmentID,
		DeploymentID:  rt.DeploymentID,
	})
	if err != nil {
		return nil, fmt.Errorf("list releases for release target: %w", err)
	}
	if len(releases) == 0 {
		return nil, nil
	}

	latest := releases[0]
	versionRow, err := q.GetDeploymentVersionByID(ctx, latest.VersionID)
	if err != nil {
		return nil, fmt.Errorf("get version %s: %w", latest.VersionID, err)
	}

	createdAt := ""
	if latest.CreatedAt.Valid {
		createdAt = latest.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *db.ToOapiDeploymentVersion(versionRow),
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          createdAt,
	}, nil
}

func (g *PostgresGetter) GetDeploymentVariables(ctx context.Context, deploymentID string) ([]oapi.DeploymentVariableWithValues, error) {
	q := db.GetQueries(ctx)

	vars, err := q.ListDeploymentVariablesByDeploymentID(ctx, uuid.MustParse(deploymentID))
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

func (g *PostgresGetter) GetResourceVariables(ctx context.Context, resourceID string) (map[string]oapi.ResourceVariable, error) {
	rows, err := db.GetQueries(ctx).ListResourceVariablesByResourceID(ctx, uuid.MustParse(resourceID))
	if err != nil {
		return nil, fmt.Errorf("list resource variables for %s: %w", resourceID, err)
	}

	result := make(map[string]oapi.ResourceVariable, len(rows))
	for _, row := range rows {
		result[row.Key] = db.ToOapiResourceVariable(row)
	}
	return result, nil
}

var celTypePattern = regexp.MustCompile(`^from\.type\s*==\s*"([^"]+)"\s*&&\s*to\.type\s*==\s*"([^"]+)"`)

func (g *PostgresGetter) GetRelationshipRules(ctx context.Context, workspaceID uuid.UUID) ([]eval.Rule, error) {
	q := db.GetQueries(ctx)

	rows, err := q.GetRelationshipRulesForWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("get rules for workspace %s: %w", workspaceID, err)
	}

	rules := make([]eval.Rule, 0, len(rows))
	for _, row := range rows {
		m := celTypePattern.FindStringSubmatch(row.Cel)
		if m == nil {
			return nil, fmt.Errorf("CEL expression does not start with expected type guards: %q", row.Cel)
		}
		rules = append(rules, eval.Rule{
			ID:        row.ID,
			Reference: row.Reference,
			Cel:       row.Cel,
		})
	}
	return rules, nil
}

func (g *PostgresGetter) LoadCandidates(ctx context.Context, workspaceID uuid.UUID, entityType string) ([]eval.EntityData, error) {
	pool := db.GetPool(ctx)

	var query string
	var buildMap func(values []any) map[string]any
	switch entityType {
	case "resource":
		query = listResourcesSQL
		buildMap = rowToResourceMap
	case "deployment":
		query = listDeploymentsSQL
		buildMap = rowToDeploymentMap
	case "environment":
		query = listEnvironmentsSQL
		buildMap = rowToEnvironmentMap
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}

	rows, err := pool.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("query %s entities for workspace %s: %w", entityType, workspaceID, err)
	}
	defer rows.Close()

	var candidates []eval.EntityData
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("scan %s row: %w", entityType, err)
		}

		id, ok := values[0].([16]byte)
		if !ok {
			continue
		}
		entityID := uuid.UUID(id)

		wsID, ok := values[1].([16]byte)
		if !ok {
			continue
		}

		candidates = append(candidates, eval.EntityData{
			ID:          entityID,
			WorkspaceID: uuid.UUID(wsID),
			EntityType:  entityType,
			Raw:         buildMap(values),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s entities: %w", entityType, err)
	}

	return candidates, nil
}

const listResourcesSQL = `
SELECT id, workspace_id, name, kind, version, identifier,
       provider_id, config, metadata, created_at, updated_at
FROM resource
WHERE workspace_id = $1 AND deleted_at IS NULL
`

const listDeploymentsSQL = `
SELECT id, workspace_id, name, description, job_agent_id, job_agent_config, metadata
FROM deployment
WHERE workspace_id = $1
`

const listEnvironmentsSQL = `
SELECT id, workspace_id, name, description, metadata, created_at
FROM environment
WHERE workspace_id = $1
`

func rowToResourceMap(values []any) map[string]any {
	m := map[string]any{"type": "resource"}
	if len(values) > 0 {
		if id, ok := values[0].([16]byte); ok {
			m["id"] = uuid.UUID(id).String()
		}
	}
	if len(values) > 2 {
		m["name"] = values[2]
	}
	if len(values) > 3 {
		m["kind"] = values[3]
	}
	if len(values) > 4 {
		m["version"] = values[4]
	}
	if len(values) > 5 {
		m["identifier"] = values[5]
	}
	if len(values) > 7 {
		m["config"] = values[7]
	}
	if len(values) > 8 {
		if md, ok := values[8].(map[string]string); ok {
			m["metadata"] = stringMapToAnyMap(md)
		}
	}
	return m
}

func rowToDeploymentMap(values []any) map[string]any {
	m := map[string]any{"type": "deployment"}
	if len(values) > 0 {
		if id, ok := values[0].([16]byte); ok {
			m["id"] = uuid.UUID(id).String()
		}
	}
	if len(values) > 2 {
		m["name"] = values[2]
	}
	if len(values) > 3 {
		m["description"] = values[3]
	}
	if len(values) > 6 {
		if md, ok := values[6].(map[string]string); ok {
			m["metadata"] = stringMapToAnyMap(md)
		}
	}
	return m
}

func rowToEnvironmentMap(values []any) map[string]any {
	m := map[string]any{"type": "environment"}
	if len(values) > 0 {
		if id, ok := values[0].([16]byte); ok {
			m["id"] = uuid.UUID(id).String()
		}
	}
	if len(values) > 2 {
		m["name"] = values[2]
	}
	if len(values) > 3 {
		m["description"] = values[3]
	}
	if len(values) > 4 {
		if md, ok := values[4].(map[string]string); ok {
			m["metadata"] = stringMapToAnyMap(md)
		}
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
