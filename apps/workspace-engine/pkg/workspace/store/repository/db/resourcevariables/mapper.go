package resourcevariables

import (
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func ToOapi(row db.ResourceVariable) *oapi.ResourceVariable {
	value := oapi.Value{}
	_ = value.UnmarshalJSON(row.Value)

	return &oapi.ResourceVariable{
		ResourceId: row.ResourceID.String(),
		Key:        row.Key,
		Value:      value,
	}
}

func ToUpsertParams(e *oapi.ResourceVariable) (db.UpsertResourceVariableParams, error) {
	rid, err := uuid.Parse(e.ResourceId)
	if err != nil {
		return db.UpsertResourceVariableParams{}, fmt.Errorf("parse resource_id: %w", err)
	}

	valueBytes, err := e.Value.MarshalJSON()
	if err != nil {
		return db.UpsertResourceVariableParams{}, fmt.Errorf("marshal value: %w", err)
	}

	return db.UpsertResourceVariableParams{
		ResourceID: rid,
		Key:        e.Key,
		Value:      valueBytes,
	}, nil
}

func parseKey(key string) (uuid.UUID, string, error) {
	if len(key) < 38 || key[36] != '-' {
		return uuid.Nil, "", fmt.Errorf("invalid resource variable key: %q", key)
	}
	rid, err := uuid.Parse(key[:36])
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("parse resource_id from key: %w", err)
	}
	return rid, key[37:], nil
}
