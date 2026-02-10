-- Minimal schema template for local sqlc experiments.
-- For workspace-engine sqlc generation in this repo see sqlc/schema/workspace_engine.sql.

CREATE TABLE workspace (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system (
    id uuid PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL DEFAULT '',
    UNIQUE (workspace_id, slug)
);

CREATE TABLE deployment (
    id uuid PRIMARY KEY,
    system_id uuid NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    job_agent_id uuid,
    job_agent_config jsonb NOT NULL DEFAULT '{}',
    retry_count integer NOT NULL DEFAULT 0,
    timeout integer,
    resource_selector jsonb
);
