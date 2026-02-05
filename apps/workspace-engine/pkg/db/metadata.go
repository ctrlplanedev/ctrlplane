package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

func parseMetadataJSON(metadataJSON []byte) (map[string]string, error) {
	if len(metadataJSON) == 0 {
		return map[string]string{}, nil
	}

	var metadataMap map[string]string
	if err := json.Unmarshal(metadataJSON, &metadataMap); err != nil {
		return nil, err
	}
	if metadataMap == nil {
		metadataMap = map[string]string{}
	}
	return metadataMap, nil
}

func writeMetadata(ctx context.Context, table string, idColumn string, entityId string, metadata map[string]string, tx pgx.Tx) error {
	if len(metadata) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(metadata))
	valueArgs := make([]interface{}, 0, len(metadata)*3)
	i := 1
	for k, v := range metadata {
		valueStrings = append(valueStrings,
			"($"+fmt.Sprintf("%d", i)+", $"+fmt.Sprintf("%d", i+1)+", $"+fmt.Sprintf("%d", i+2)+")",
		)
		valueArgs = append(valueArgs, entityId, k, v)
		i += 3
	}

	query := fmt.Sprintf(
		"INSERT INTO %s (%s, key, value) VALUES %s ON CONFLICT (%s, key) DO UPDATE SET value = EXCLUDED.value",
		table,
		idColumn,
		strings.Join(valueStrings, ", "),
		idColumn,
	)

	_, err := tx.Exec(ctx, query, valueArgs...)
	if err != nil {
		return err
	}
	return nil
}
