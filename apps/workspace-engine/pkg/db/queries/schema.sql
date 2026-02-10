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