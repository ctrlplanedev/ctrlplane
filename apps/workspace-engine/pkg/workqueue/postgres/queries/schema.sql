CREATE TABLE reconcile_work_item (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL,
    kind TEXT NOT NULL,
    scope_type TEXT NOT NULL DEFAULT '',
    scope_id TEXT NOT NULL DEFAULT '',
    event_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    priority SMALLINT NOT NULL DEFAULT 100,
    not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempt_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    claimed_by TEXT,
    claimed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, kind, scope_type, scope_id)
);
