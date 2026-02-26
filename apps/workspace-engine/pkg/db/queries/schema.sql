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

CREATE TABLE deployment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    job_agent_id UUID,
    job_agent_config JSONB NOT NULL DEFAULT '{}',
    job_agents JSONB NOT NULL DEFAULT '[]',
    resource_selector TEXT DEFAULT 'false',
    metadata JSONB NOT NULL DEFAULT '{}',
    workspace_id UUID REFERENCES workspace(id)
);

CREATE TABLE job_agent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSON NOT NULL DEFAULT '{}'
);

CREATE TABLE environment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    resource_selector TEXT NOT NULL DEFAULT 'false',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE resource_provider (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TYPE deployment_version_status AS ENUM ('building', 'ready', 'failed', 'rejected', 'paused');

CREATE TABLE deployment_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tag TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    job_agent_config JSONB NOT NULL DEFAULT '{}',
    deployment_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    status deployment_version_status NOT NULL DEFAULT 'ready',
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workspace_id UUID REFERENCES workspace(id),
    CONSTRAINT deployment_version_uniq UNIQUE (deployment_id, tag)
);

CREATE TABLE changelog_entry (
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, entity_type, entity_id)
);

CREATE TABLE system_environment (
    system_id UUID NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (system_id, environment_id)
);

CREATE TABLE system_deployment (
    system_id UUID NOT NULL REFERENCES system(id) ON DELETE CASCADE,
    deployment_id UUID NOT NULL REFERENCES deployment(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (system_id, deployment_id)
);

CREATE TABLE release (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL,
    environment_id UUID NOT NULL,
    deployment_id UUID NOT NULL,
    version_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE release_variable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id UUID NOT NULL REFERENCES release(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT release_variable_release_id_key_uniq UNIQUE (release_id, key)
);

CREATE TABLE policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    selector TEXT NOT NULL DEFAULT 'true',
    metadata JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_any_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    min_approvals INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_deployment_dependency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    depends_on TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_deployment_window (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    allow_window BOOLEAN,
    duration_minutes INTEGER NOT NULL,
    rrule TEXT NOT NULL,
    timezone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_environment_progression (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    depends_on_environment_selector TEXT NOT NULL,
    maximum_age_hours INTEGER,
    minimum_soak_time_minutes INTEGER,
    minimum_success_percentage REAL,
    success_statuses TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_gradual_rollout (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    rollout_type TEXT NOT NULL,
    time_scale_interval INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_retry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    max_retries INTEGER NOT NULL,
    backoff_seconds INTEGER,
    backoff_strategy TEXT,
    max_backoff_seconds INTEGER,
    retry_on_statuses TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_rollback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    on_job_statuses TEXT[],
    on_verification_failure BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    metrics JSONB NOT NULL DEFAULT '[]',
    trigger_on TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_version_cooldown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    interval_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_rule_version_selector (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
    description TEXT,
    selector TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_approval_record (
    version_id UUID NOT NULL,
    user_id UUID NOT NULL,
    environment_id UUID NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (version_id, user_id, environment_id)
);

CREATE TABLE resource_variable (
    resource_id UUID NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    PRIMARY KEY (resource_id, key)
);