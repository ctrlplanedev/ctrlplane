-- name: BatchUpsertResource :batchexec
INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id,
                      config, created_at, updated_at, deleted_at, metadata)
VALUES ($1, $2, $3, $4, $5,
        NULLIF(sqlc.arg(provider_id), '00000000-0000-0000-0000-000000000000'::uuid),
        $7, $8, $9, $10, $11, $12)
ON CONFLICT (workspace_id, identifier) DO UPDATE
SET id = EXCLUDED.id, version = EXCLUDED.version, name = EXCLUDED.name,
    kind = EXCLUDED.kind, provider_id = EXCLUDED.provider_id,
    config = EXCLUDED.config, updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at, metadata = EXCLUDED.metadata;

-- name: DeleteResourcesByIDs :exec
DELETE FROM resource WHERE id = ANY($1::uuid[]);
