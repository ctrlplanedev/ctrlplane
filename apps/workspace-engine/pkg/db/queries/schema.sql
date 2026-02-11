CREATE TABLE workspace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    workspace_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE resource (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    identifier TEXT NOT NULL,
    provider_id UUID REFERENCES resource_provider(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TYPE deployment_version_status AS ENUM ('building', 'ready', 'failed', 'rejected');

CREATE TABLE deployment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    system_id UUID NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    job_agent_id UUID,
    job_agent_config JSONB NOT NULL DEFAULT '{}',
    resource_selector JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deployment_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tag TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    job_agent_config JSONB NOT NULL DEFAULT '{}',
    deployment_id UUID NOT NULL REFERENCES deployment(id) ON DELETE CASCADE,
    status deployment_version_status NOT NULL DEFAULT 'ready',
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workspace_id UUID REFERENCES workspace(id),
    CONSTRAINT deployment_version_uniq UNIQUE (deployment_id, tag)
);

CREATE TABLE environment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    directory TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    resource_selector JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT environment_uniq UNIQUE (system_id, name)
);

CREATE TABLE changelog_entry (
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, entity_type, entity_id)
);