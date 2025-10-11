package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
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

	matcher := &oapi.RelationshipRule_Matcher{}
	matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: propertyMatchers,
	})
	return &oapi.RelationshipRule{
		Id:               dbRelationship.ID,
		Name:             name,
		Description:      dbRelationship.Description,
		FromSelector:     fromSelector,
		ToSelector:       toSelector,
		Matcher:          *matcher,
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

const INSERT_RELATIONSHIP_RULE_QUERY = `
	INSERT INTO resource_relationship_rule (id, name, reference, dependency_type, description, workspace_id, source_kind, source_version, target_kind, target_version)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`

func writeRelationshipRule(ctx context.Context, relationshipRule *oapi.RelationshipRule, tx pgx.Tx) error {
	// Parse selectors to extract DB fields
	sourceKind, sourceVersion, sourceMetadataEquals := extractFromSelector(relationshipRule.FromSelector)
	targetKind, targetVersion, targetMetadataEquals := extractToSelector(relationshipRule.ToSelector)

	// Insert main rule
	if _, err := tx.Exec(
		ctx,
		INSERT_RELATIONSHIP_RULE_QUERY,
		relationshipRule.Id,
		relationshipRule.Name,
		relationshipRule.Reference,
		relationshipRule.RelationshipType,
		relationshipRule.Description,
		relationshipRule.WorkspaceId,
		sourceKind,
		sourceVersion,
		targetKind,
		targetVersion,
	); err != nil {
		return err
	}

	// Insert metadata matches from property matchers
	if len(relationshipRule.PropertyMatchers) > 0 {
		if err := writeManyMetadataMatches(ctx, relationshipRule.Id, relationshipRule.PropertyMatchers, tx); err != nil {
			return err
		}
	}

	// Insert source metadata equals
	if len(sourceMetadataEquals) > 0 {
		if err := writeManySourceMetadataEquals(ctx, relationshipRule.Id, sourceMetadataEquals, tx); err != nil {
			return err
		}
	}

	// Insert target metadata equals
	if len(targetMetadataEquals) > 0 {
		if err := writeManyTargetMetadataEquals(ctx, relationshipRule.Id, targetMetadataEquals, tx); err != nil {
			return err
		}
	}

	return nil
}

func extractFromSelector(selector *oapi.Selector) (kind string, version string, metadataEquals []dbRelationshipRuleSourceMetadataEquals) {
	metadataEquals = make([]dbRelationshipRuleSourceMetadataEquals, 0)
	if selector == nil {
		return
	}

	jsonSelector, err := selector.AsJsonSelector()
	if err != nil {
		return
	}

	selectorType, _ := jsonSelector.Json["type"].(string)
	if selectorType != "comparison" {
		return
	}

	conditions, ok := jsonSelector.Json["conditions"].([]interface{})
	if !ok {
		return
	}

	for _, condition := range conditions {
		condMap, ok := condition.(map[string]interface{})
		if !ok {
			continue
		}

		condType, _ := condMap["type"].(string)
		switch condType {
		case "kind":
			if val, ok := condMap["value"].(string); ok {
				kind = val
			}
		case "version":
			if val, ok := condMap["value"].(string); ok {
				version = val
			}
		case "metadata":
			key, keyOk := condMap["key"].(string)
			value, valueOk := condMap["value"].(string)
			if keyOk && valueOk {
				metadataEquals = append(metadataEquals, dbRelationshipRuleSourceMetadataEquals{
					Key:   key,
					Value: value,
				})
			}
		}
	}

	return
}

func extractToSelector(selector *oapi.Selector) (kind *string, version *string, metadataEquals []dbRelationshipRuleTargetMetadataEquals) {
	metadataEquals = make([]dbRelationshipRuleTargetMetadataEquals, 0)
	if selector == nil {
		return
	}

	jsonSelector, err := selector.AsJsonSelector()
	if err != nil {
		return
	}

	selectorType, _ := jsonSelector.Json["type"].(string)
	if selectorType != "comparison" {
		return
	}

	conditions, ok := jsonSelector.Json["conditions"].([]interface{})
	if !ok {
		return
	}

	for _, condition := range conditions {
		condMap, ok := condition.(map[string]interface{})
		if !ok {
			continue
		}

		condType, _ := condMap["type"].(string)
		switch condType {
		case "kind":
			if val, ok := condMap["value"].(string); ok {
				kind = &val
			}
		case "version":
			if val, ok := condMap["value"].(string); ok {
				version = &val
			}
		case "metadata":
			key, keyOk := condMap["key"].(string)
			value, valueOk := condMap["value"].(string)
			if keyOk && valueOk {
				metadataEquals = append(metadataEquals, dbRelationshipRuleTargetMetadataEquals{
					Key:   key,
					Value: value,
				})
			}
		}
	}

	return
}

func writeManyMetadataMatches(ctx context.Context, ruleId string, matchers []oapi.PropertyMatcher, tx pgx.Tx) error {
	if len(matchers) == 0 {
		return nil
	}

	valueStrings := make([]string, 0)
	valueArgs := make([]interface{}, 0)
	i := 1

	for _, matcher := range matchers {
		// Only handle metadata property matchers
		if len(matcher.FromProperty) >= 2 && len(matcher.ToProperty) >= 2 &&
			matcher.FromProperty[0] == "metadata" && matcher.ToProperty[0] == "metadata" {
			valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d)", i, i+1, i+2))
			valueArgs = append(valueArgs, ruleId, matcher.FromProperty[1], matcher.ToProperty[1])
			i += 3
		}
	}

	if len(valueStrings) == 0 {
		return nil
	}

	query := "INSERT INTO resource_relationship_rule_metadata_match (resource_relationship_rule_id, source_key, target_key) VALUES " +
		strings.Join(valueStrings, ", ")

	_, err := tx.Exec(ctx, query, valueArgs...)
	return err
}

func writeManySourceMetadataEquals(ctx context.Context, ruleId string, metadataEquals []dbRelationshipRuleSourceMetadataEquals, tx pgx.Tx) error {
	if len(metadataEquals) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(metadataEquals))
	valueArgs := make([]interface{}, 0, len(metadataEquals)*3)
	i := 1

	for _, metadata := range metadataEquals {
		valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d)", i, i+1, i+2))
		valueArgs = append(valueArgs, ruleId, metadata.Key, metadata.Value)
		i += 3
	}

	query := "INSERT INTO resource_relationship_rule_source_metadata_equals (resource_relationship_rule_id, key, value) VALUES " +
		strings.Join(valueStrings, ", ")

	_, err := tx.Exec(ctx, query, valueArgs...)
	return err
}

func writeManyTargetMetadataEquals(ctx context.Context, ruleId string, metadataEquals []dbRelationshipRuleTargetMetadataEquals, tx pgx.Tx) error {
	if len(metadataEquals) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(metadataEquals))
	valueArgs := make([]interface{}, 0, len(metadataEquals)*3)
	i := 1

	for _, metadata := range metadataEquals {
		valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d)", i, i+1, i+2))
		valueArgs = append(valueArgs, ruleId, metadata.Key, metadata.Value)
		i += 3
	}

	query := "INSERT INTO resource_relationship_rule_target_metadata_equals (resource_relationship_rule_id, key, value) VALUES " +
		strings.Join(valueStrings, ", ")

	_, err := tx.Exec(ctx, query, valueArgs...)
	return err
}

const DELETE_RELATIONSHIP_RULE_QUERY = `
	DELETE FROM resource_relationship_rule WHERE id = $1
`

func deleteRelationshipRule(ctx context.Context, relationshipRuleId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_RELATIONSHIP_RULE_QUERY, relationshipRuleId); err != nil {
		return err
	}
	return nil
}
