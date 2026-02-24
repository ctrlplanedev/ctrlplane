-- One row per logical reconcile scope. This table owns leasing/scheduling.
CREATE TABLE reconcile_work_scope (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL,
    kind TEXT NOT NULL,
    scope_type TEXT NOT NULL DEFAULT '',
    scope_id TEXT NOT NULL DEFAULT '',
    event_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    priority SMALLINT NOT NULL DEFAULT 100,
    not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_by TEXT,
    claimed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, kind, scope_type, scope_id)
);

-- Many payload variants can be queued per scope row.
CREATE TABLE reconcile_work_payload (
    id BIGSERIAL PRIMARY KEY,
    scope_ref BIGINT NOT NULL REFERENCES reconcile_work_scope(id) ON DELETE CASCADE,
    payload_type TEXT NOT NULL DEFAULT '',
    payload_key TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scope_ref, payload_type, payload_key)
);

-- Claim path scans ready scopes by kind/not_before/priority/event ordering.
CREATE INDEX reconcile_work_scope_claim_idx
  ON reconcile_work_scope (kind, not_before, priority, event_ts, claimed_until);

-- Fast payload lookup for a claimed scope.
CREATE INDEX reconcile_work_payload_scope_ref_idx
  ON reconcile_work_payload (scope_ref);
