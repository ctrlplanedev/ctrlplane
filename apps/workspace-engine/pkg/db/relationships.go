package db

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/oapi"

	"github.com/jackc/pgx/v5"
)

const RELATIONSHIP_SELECT_QUERY = `
	SELECT
		r.id,
		r.name,
		r.reference,
		r.dependency_type,
		r.description,
		r.source_kind,
		r.source_version,
		r.target_kind,
		r.target_version,
		COALESCE(json_agg(json_build_object(
			'source_key', rm.source_key, 
			'target_key', rm.target_key
		)) FILTER (WHERE rm.resource_relationship_rule_id IS NOT NULL), '[]') AS metadata_matches,
		COALESCE(json_agg(json_build_object(
			'key', rme.key,
			'value', rme.value
		)) FILTER (WHERE rme.resource_relationship_rule_id IS NOT NULL), '[]') AS target_metadata_equals,
		COALESCE(json_agg(json_build_object(
			'key', rse.key,
			'value', rse.value
		)) FILTER (WHERE rse.resource_relationship_rule_id IS NOT NULL), '[]') AS source_metadata_equals
	FROM resource_relationship_rule r
	LEFT JOIN resource_relationship_rule_metadata_match rm ON rm.resource_relationship_rule_id = r.id
	LEFT JOIN resource_relationship_rule_target_metadata_equals rme ON rme.resource_relationship_rule_id = r.id
	LEFT JOIN resource_relationship_rule_source_metadata_equals rse ON rse.resource_relationship_rule_id = r.id
	WHERE r.workspace_id = $1
	GROUP BY r.id
`

type dbRelationshipRuleMetadataMatch struct {
	SourceKey string `db:"source_key" json:"source_key"`
	TargetKey string `db:"target_key" json:"target_key"`
}

type dbRelationshipRuleTargetMetadataEquals struct {
	Key   string `db:"key" json:"key"`
	Value string `db:"value" json:"value"`
}

type dbRelationshipRuleSourceMetadataEquals struct {
	Key   string `db:"key" json:"key"`
	Value string `db:"value" json:"value"`
}

type dbRelationshipRule struct {
	ID                   string                                   `db:"id"`
	Name                 *string                                  `db:"name"`
	Reference            string                                   `db:"reference"`
	DependencyType       string                                   `db:"dependency_type"`
	Description          *string                                  `db:"description"`
	SourceKind           string                                   `db:"source_kind"`
	SourceVersion        string                                   `db:"source_version"`
	TargetKind           *string                                  `db:"target_kind"`
	TargetVersion        *string                                  `db:"target_version"`
	MetadataMatches      []dbRelationshipRuleMetadataMatch        `db:"metadata_matches"`
	TargetMetadataEquals []dbRelationshipRuleTargetMetadataEquals `db:"target_metadata_equals"`
	SourceMetadataEquals []dbRelationshipRuleSourceMetadataEquals `db:"source_metadata_equals"`
}

func getRelationships(ctx context.Context, workspaceID string) ([]*oapi.RelationshipRule, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, RELATIONSHIP_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dbRelationships := make([]*dbRelationshipRule, 0)
	for rows.Next() {
		dbRelationship, err := scanRelationshipRuleRow(rows)
		if err != nil {
			return nil, err
		}
		dbRelationships = append(dbRelationships, dbRelationship)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	relationships := make([]*oapi.RelationshipRule, 0)
	for _, dbRelationship := range dbRelationships {
		oapiRelationship, err := convertDbRelationshipRuleToOapiRelationshipRule(dbRelationship)
		if err != nil {
			return nil, err
		}
		relationships = append(relationships, oapiRelationship)
	}
	return relationships, nil
}

func getFromSelector(dbRelationship *dbRelationshipRule) (*oapi.Selector, error) {
	dbSourceMetadataEquals := dbRelationship.SourceMetadataEquals
	dbSourceKind := dbRelationship.SourceKind
	dbSourceVersion := dbRelationship.SourceVersion

	if len(dbSourceMetadataEquals) == 0 && dbSourceKind == "" && dbSourceVersion == "" {
		return nil, nil
	}

	rawSelector := map[string]any{
		"type":       "comparison",
		"operator":   "and",
		"conditions": []map[string]any{},
	}

	if dbSourceKind != "" {
		rawSelector["conditions"] = append(rawSelector["conditions"].([]map[string]any), map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    dbSourceKind,
		})
	}

	if dbSourceVersion != "" {
		rawSelector["conditions"] = append(rawSelector["conditions"].([]map[string]any), map[string]any{
			"type":     "version",
			"operator": "equals",
			"value":    dbSourceVersion,
		})
	}

	for _, dbSourceMetadataEqualRule := range dbSourceMetadataEquals {
		rawSelector["conditions"] = append(rawSelector["conditions"].([]map[string]any), map[string]any{
			"type":     "metadata",
			"operator": "equals",
			"key":      dbSourceMetadataEqualRule.Key,
			"value":    dbSourceMetadataEqualRule.Value,
		})
	}

	rawSelectorJSON, err := json.Marshal(rawSelector)
	if err != nil {
		return nil, err
	}

	var v oapi.Selector
	if err := v.UnmarshalJSON(rawSelectorJSON); err != nil {
		return nil, err
	}
	return &v, nil
}

func getToSelector(dbRelationship *dbRelationshipRule) (*oapi.Selector, error) {
	dbTargetMetadataEquals := dbRelationship.TargetMetadataEquals
	dbTargetKind := dbRelationship.TargetKind
	dbTargetVersion := dbRelationship.TargetVersion

	if len(dbTargetMetadataEquals) == 0 && dbTargetKind == nil && dbTargetVersion == nil {
		return nil, nil
	}

	rawSelector := map[string]any{
		"type":       "comparison",
		"operator":   "and",
		"conditions": []map[string]any{},
	}

	if dbTargetKind != nil {
		rawSelector["conditions"] = append(rawSelector["conditions"].([]map[string]any), map[string]any{
			"type":     "kind",
			"operator": oapi.Equals,
			"value":    *dbTargetKind,
		})
	}

	if dbTargetVersion != nil {
		rawSelector["conditions"] = append(rawSelector["conditions"].([]map[string]any), map[string]any{
			"type":     "version",
			"operator": oapi.Equals,
			"value":    *dbTargetVersion,
		})
	}

	for _, dbTargetMetadataEqualRule := range dbTargetMetadataEquals {
		rawSelector["conditions"] = append(rawSelector["conditions"].([]map[string]any), map[string]any{
			"type":     "metadata",
			"operator": oapi.Equals,
			"key":      dbTargetMetadataEqualRule.Key,
			"value":    dbTargetMetadataEqualRule.Value,
		})
	}

	rawSelectorJSON, err := json.Marshal(rawSelector)
	if err != nil {
		return nil, err
	}
	var v oapi.Selector
	if err := v.UnmarshalJSON(rawSelectorJSON); err != nil {
		return nil, err
	}
	return &v, nil
}

func getPropertyMatchers(dbRelationship *dbRelationshipRule) []oapi.PropertyMatcher {
	propertyMatchers := make([]oapi.PropertyMatcher, 0)
	for _, dbPropertyMatcher := range dbRelationship.MetadataMatches {
		propertyMatcher := oapi.PropertyMatcher{
			FromProperty: []string{"metadata", dbPropertyMatcher.SourceKey},
			ToProperty:   []string{"metadata", dbPropertyMatcher.TargetKey},
			Operator:     oapi.Equals,
		}
		propertyMatchers = append(propertyMatchers, propertyMatcher)
	}

	return propertyMatchers
}

func getName(dbRelationship *dbRelationshipRule) string {
	if dbRelationship.Name == nil {
		return ""
	}
	return *dbRelationship.Name
}

func convertDbRelationshipRuleToOapiRelationshipRule(dbRelationship *dbRelationshipRule) (*oapi.RelationshipRule, error) {
	fromSelector, err := getFromSelector(dbRelationship)
	if err != nil {
		return nil, err
	}
	toSelector, err := getToSelector(dbRelationship)
	if err != nil {
		return nil, err
	}
	propertyMatchers := getPropertyMatchers(dbRelationship)
	name := getName(dbRelationship)

	return &oapi.RelationshipRule{
		Id:               dbRelationship.ID,
		Name:             name,
		Description:      dbRelationship.Description,
		FromSelector:     fromSelector,
		ToSelector:       toSelector,
		PropertyMatchers: propertyMatchers,
		FromType:         "resource",
		ToType:           "resource",
		RelationshipType: dbRelationship.DependencyType,
		Metadata:         map[string]string{},
		Reference:        dbRelationship.Reference,
	}, nil
}

func scanRelationshipRuleRow(rows pgx.Rows) (*dbRelationshipRule, error) {
	dbRelationship := &dbRelationshipRule{}
	err := rows.Scan(
		&dbRelationship.ID,
		&dbRelationship.Name,
		&dbRelationship.Reference,
		&dbRelationship.DependencyType,
		&dbRelationship.Description,
		&dbRelationship.SourceKind,
		&dbRelationship.SourceVersion,
		&dbRelationship.TargetKind,
		&dbRelationship.TargetVersion,
		&dbRelationship.MetadataMatches,
		&dbRelationship.TargetMetadataEquals,
		&dbRelationship.SourceMetadataEquals,
	)
	if err != nil {
		return nil, err
	}
	return dbRelationship, nil
}
