CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE workspace (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL DEFAULT '',
    UNIQUE (workspace_id, slug)
);

CREATE TABLE job_agent (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE deployment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    system_id uuid NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    job_agent_id uuid REFERENCES job_agent(id) ON DELETE SET NULL,
    job_agent_config jsonb NOT NULL DEFAULT '{}',
    retry_count integer NOT NULL DEFAULT 0,
    timeout integer,
    resource_selector jsonb,
    UNIQUE (system_id, slug)
);

CREATE TABLE environment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id uuid NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    description text,
    resource_selector jsonb,
    UNIQUE (system_id, name)
);

CREATE TABLE resource (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE release_target (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id uuid NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    environment_id uuid NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
    deployment_id uuid NOT NULL REFERENCES deployment(id) ON DELETE CASCADE,
    UNIQUE (resource_id, environment_id, deployment_id)
);
