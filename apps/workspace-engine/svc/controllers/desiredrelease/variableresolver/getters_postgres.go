package variableresolver

import (
	"context"
	"fmt"
	"regexp"

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

var celTypePattern = regexp.MustCompile(
	`^from\.type\s*==\s*"([^"]+)"\s*&&\s*to\.type\s*==\s*"([^"]+)"`,
)

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
		m := celTypePattern.FindStringSubmatch(row.Cel)
		if m == nil {
			return nil, fmt.Errorf(
				"CEL expression does not start with expected type guards: %q",
				row.Cel,
			)
		}
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
		return nil, fmt.Errorf(
			"query %s entities for workspace %s: %w",
			entityType,
			workspaceID,
			err,
		)
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

const getResourceByIDSQL = `
SELECT id, workspace_id, name, kind, version, identifier,
       provider_id, config, metadata, created_at, updated_at
FROM resource
WHERE id = $1 AND deleted_at IS NULL
`

const getDeploymentByIDSQL = `
SELECT id, workspace_id, name, description, job_agent_id, job_agent_config, metadata
FROM deployment
WHERE id = $1
`

const getEnvironmentByIDSQL = `
SELECT id, workspace_id, name, description, metadata, created_at
FROM environment
WHERE id = $1
`

func (g *PostgresGetter) GetEntityByID(
	ctx context.Context,
	entityID uuid.UUID,
	entityType string,
) (*eval.EntityData, error) {
	pool := db.GetPool(ctx)

	var query string
	var buildMap func(values []any) map[string]any
	switch entityType {
	case "resource":
		query = getResourceByIDSQL
		buildMap = rowToResourceMap
	case "deployment":
		query = getDeploymentByIDSQL
		buildMap = rowToDeploymentMap
	case "environment":
		query = getEnvironmentByIDSQL
		buildMap = rowToEnvironmentMap
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}

	rows, err := pool.Query(ctx, query, entityID)
	if err != nil {
		return nil, fmt.Errorf("query %s by id %s: %w", entityType, entityID, err)
	}
	defer rows.Close()

	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("iterate %s row: %w", entityType, err)
		}
		return nil, fmt.Errorf("%s with id %s not found", entityType, entityID)
	}

	values, err := rows.Values()
	if err != nil {
		return nil, fmt.Errorf("scan %s row: %w", entityType, err)
	}

	id, ok := values[0].([16]byte)
	if !ok {
		return nil, fmt.Errorf("invalid id type for %s %s", entityType, entityID)
	}

	wsID, ok := values[1].([16]byte)
	if !ok {
		return nil, fmt.Errorf("invalid workspace_id type for %s %s", entityType, entityID)
	}

	return &eval.EntityData{
		ID:          uuid.UUID(id),
		WorkspaceID: uuid.UUID(wsID),
		EntityType:  entityType,
		Raw:         buildMap(values),
	}, nil
}

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
