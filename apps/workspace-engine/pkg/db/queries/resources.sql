-- name: GetResourceByID :one
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       config, created_at, updated_at, deleted_at, metadata
FROM resource
WHERE id = $1;

-- name: GetResourceByIdentifier :one
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       config, created_at, updated_at, deleted_at, metadata
FROM resource
WHERE workspace_id = $1 AND identifier = $2
LIMIT 1;

-- name: ListResourcesByWorkspaceID :many
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       config, created_at, updated_at, deleted_at, metadata
FROM resource
WHERE workspace_id = $1;

-- name: UpsertResource :one
INSERT INTO resource (id, version, name, kind, identifier, provider_id, workspace_id,
                      config, created_at, updated_at, deleted_at, metadata)
VALUES ($1, $2, $3, $4, $5,
        NULLIF(sqlc.arg(provider_id), '00000000-0000-0000-0000-000000000000'::uuid),
        $7, $8, $9, $10, $11, $12)
ON CONFLICT (workspace_id, identifier) DO UPDATE
SET id = EXCLUDED.id, version = EXCLUDED.version, name = EXCLUDED.name,
    kind = EXCLUDED.kind, provider_id = EXCLUDED.provider_id,
    config = EXCLUDED.config, updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at, metadata = EXCLUDED.metadata
RETURNING id, version, name, kind, identifier, provider_id, workspace_id,
         config, created_at, updated_at, deleted_at, metadata;

-- name: ListResourcesByIdentifiers :many
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       config, created_at, updated_at, deleted_at, metadata
FROM resource
WHERE workspace_id = $1 AND identifier = ANY($2::text[]);

-- name: ListResourceSummariesByIdentifiers :many
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       created_at, updated_at
FROM resource
WHERE workspace_id = $1 AND identifier = ANY($2::text[]);

-- name: ListResourcesByProviderID :many
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       config, created_at, updated_at, deleted_at, metadata
FROM resource
WHERE provider_id = $1;

-- name: DeleteResource :exec
DELETE FROM resource WHERE id = $1;
