package deploymentvariables

import (
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func VariableToOapi(row db.DeploymentVariable) *oapi.DeploymentVariable {
	var description *string
	if row.Description.Valid {
		description = &row.Description.String
	}

	var defaultValue *oapi.LiteralValue
	if row.DefaultValue != nil {
		lv := &oapi.LiteralValue{}
		if err := json.Unmarshal(row.DefaultValue, lv); err == nil {
			defaultValue = lv
		}
	}

	return &oapi.DeploymentVariable{
		Id:           row.ID.String(),
		DeploymentId: row.DeploymentID.String(),
		Key:          row.Key,
		Description:  description,
		DefaultValue: defaultValue,
	}
}

func ToVariableUpsertParams(e *oapi.DeploymentVariable) (db.UpsertDeploymentVariableParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertDeploymentVariableParams{}, fmt.Errorf("parse id: %w", err)
	}

	did, err := uuid.Parse(e.DeploymentId)
	if err != nil {
		return db.UpsertDeploymentVariableParams{}, fmt.Errorf("parse deployment_id: %w", err)
	}

	var description pgtype.Text
	if e.Description != nil {
		description = pgtype.Text{String: *e.Description, Valid: true}
	}

	var defaultValue []byte
	if e.DefaultValue != nil {
		defaultValue, err = json.Marshal(e.DefaultValue)
		if err != nil {
			return db.UpsertDeploymentVariableParams{}, fmt.Errorf("marshal default_value: %w", err)
		}
	}

	return db.UpsertDeploymentVariableParams{
		ID:           id,
		DeploymentID: did,
		Key:          e.Key,
		Description:  description,
		DefaultValue: defaultValue,
	}, nil
}

func ValueToOapi(row db.DeploymentVariableValue) *oapi.DeploymentVariableValue {
	var resourceSelector *oapi.Selector
	if row.ResourceSelector.Valid && row.ResourceSelector.String != "" {
		sel := &oapi.Selector{}
		celJSON, _ := json.Marshal(oapi.CelSelector{Cel: row.ResourceSelector.String})
		_ = sel.UnmarshalJSON(celJSON)
		resourceSelector = sel
	}

	value := oapi.Value{}
	_ = value.UnmarshalJSON(row.Value)

	return &oapi.DeploymentVariableValue{
		Id:                   row.ID.String(),
		DeploymentVariableId: row.DeploymentVariableID.String(),
		Value:                value,
		ResourceSelector:     resourceSelector,
		Priority:             row.Priority,
	}
}

func ToValueUpsertParams(e *oapi.DeploymentVariableValue) (db.UpsertDeploymentVariableValueParams, error) {
	id, err := uuid.Parse(e.Id)
	if err != nil {
		return db.UpsertDeploymentVariableValueParams{}, fmt.Errorf("parse id: %w", err)
	}

	dvid, err := uuid.Parse(e.DeploymentVariableId)
	if err != nil {
		return db.UpsertDeploymentVariableValueParams{}, fmt.Errorf("parse deployment_variable_id: %w", err)
	}

	var resourceSelector pgtype.Text
	if e.ResourceSelector != nil {
		cel, err := e.ResourceSelector.AsCelSelector()
		if err == nil && cel.Cel != "" {
			resourceSelector = pgtype.Text{String: cel.Cel, Valid: true}
		}
	}

	valueBytes, err := e.Value.MarshalJSON()
	if err != nil {
		return db.UpsertDeploymentVariableValueParams{}, fmt.Errorf("marshal value: %w", err)
	}

	return db.UpsertDeploymentVariableValueParams{
		ID:                   id,
		DeploymentVariableID: dvid,
		Value:                valueBytes,
		ResourceSelector:     resourceSelector,
		Priority:             e.Priority,
	}, nil
}
