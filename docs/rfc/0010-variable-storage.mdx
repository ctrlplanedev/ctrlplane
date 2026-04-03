# RFC 0010:  Unified Variable & Secret Resolution System

| Category | Status | Created | Author |
| --- | --- | --- | --- |
| Infrastructure | <Badge color="gray">Draft</Badge> | 2026-04-01 | Mike Leone |

## **Summary**

This RFC proposes a unified data model for managing variables across resources, deployments, and deployment job agents. It consolidates the current fragmented schema into a single, extensible system that supports:

- Multiple scopes (resource, deployment, deployment job agent)
- Multiple value types (literal, reference, secret reference)
- Override semantics via selectors and priority
- First-class support for secret providers without duplicating schema

The proposal replaces multiple duplicated tables with two core tables: variable and variable_value.

---

## **Motivation**

The current schema exhibits significant duplication across two dimensions:

1. **Scope duplication**
    - Separate handling for resource, deployment, and job-agent variables
2. **Value-type duplication**
    - Separate tables for literal values and reference values

This results in:

- Schema explosion and maintenance overhead
- Repeated logic in queries and resolution code
- Increased risk of inconsistency and bugs
- Difficulty extending the system (e.g., adding secrets)

Additionally, introducing secrets under the current model would require duplicating the entire table structure again, further compounding complexity.

We need a model that:

- Treats scope and value type as data, not schema
- Supports extensibility without table proliferation
- Centralizes resolution logic

---

## **Goals**

- Eliminate duplicated tables across scopes and value types
- Provide a single resolution model for all variable types
- Support secret references without storing raw secrets
- Maintain strong data integrity constraints
- Enable future extensibility (new value types, new scopes)

---

## **Non-Goals**

- Implementing secret storage (this system references external providers)
- Defining a full selector language
- Enforcing cross-variable resolution correctness at the database level

---

## **Proposal**

```jsx
CREATE TYPE variable_scope as ENUM (
            'resource',
            'deployment',
            'deployment_job_agent'
);

CREATE TYPE variable_value_kind as ENUM (
            'literal',
            'ref',
            'secret_ref'
);

CREATE TABLE IF NOT EXISTS variable (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

    scope variable_scope not null,

    resource_id uuid references resource(id) on delete cascade,
    deployment_id uuid references deployment(id) on delete cascade,
    deployment_job_agent_id uuid references deployment_job_agent(id) on delete cascade,

    key text not null,

    -- metadata
    is_sensitive boolean not null default false,
    description text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- exactly one owner target must be set, and it must match scope
    CONSTRAINT variable_scope_target_check check (
        (
            scope = 'resource'
            and resource_id is not null
            and deployment_id is null
            and deployment_job_agent_id is null
        )
        or
        (
            scope = 'deployment'
            and deployment_id is not null
            and resource_id is null
            and deployment_job_agent_id is null
        )
        or
        (
            scope = 'deployment_job_agent'
            and deployment_job_agent_id is not null
            and resource_id is null
            and deployment_id is null
        )
    )
);

create unique index if not exists variable_resource_key_uniq
    on variable(resource_id, key)
    where resource_id is not null;

create unique index if not exists variable_deployment_key_uniq
    on variable(deployment_id, key)
    where deployment_id is not null;

create unique index if not exists variable_dja_key_uniq
    on variable(deployment_job_agent_id, key)
    where deployment_job_agent_id is not null;

create index if not exists variable_scope_idx
    on variable(scope);

create index if not exists variable_resource_lookup_idx
    on variable(resource_id, key)
    where resource_id is not null;

create index if not exists variable_deployment_lookup_idx
    on variable(deployment_id, key)
    where deployment_id is not null;

create index if not exists variable_dja_lookup_idx
    on variable(deployment_job_agent_id, key)
    where deployment_job_agent_id is not null;


CREATE TABLE IF NOT EXISTS variable_value (
    id uuid primary key default uuid_generate_v4(),

    variable_id uuid not null references variable(id) on delete cascade,

    resource_selector text,

    priority bigint not null default 0,

    kind variable_value_kind not null,

    literal_value jsonb,

    ref_key text,
    ref_path text[],

    secret_provider text,
    secret_key text,
    secret_path text[],

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    CONSTRAINT variable_value_kind_shape_check check (
        (
            kind = 'literal'
            and literal_value is not null
            and ref_key is null
            and ref_path is null
            and secret_provider is null
            and secret_key is null
            and secret_path is null
        )
        or
        (
            kind = 'ref'
            and literal_value is null
            and ref_key is not null
            and secret_provider is null
            and secret_key is null
            and secret_path is null
        )
        or
        (
            kind = 'secret_ref'
            and literal_value is null
            and ref_key is null
            and ref_path is null
            and secret_provider is not null
            and secret_key is not null
        )
    )
);

create index if not exists variable_value_variable_priority_idx
    on variable_value(variable_id, priority desc, id);

create index if not exists variable_value_selector_idx
    on variable_value(variable_id, resource_selector, priority desc);

create index if not exists variable_value_kind_idx
    on variable_value(kind);

create unique index if not exists variable_value_resolution_uniq
    on variable_value (
        variable_id,
        coalesce(resource_selector, ''),
        priority
    );


```

### **Core Concepts**

The system is built around two primary entities:

1. **Variable**
    - Defines a key within a specific scope
2. **Variable Value**
    - Defines one or more candidate values for a variable
    - Supports override semantics via priority and selectors

---

### **Variable**

Represents a named configuration key scoped to a specific owner.

Key properties:

- scope: one of resource, deployment, deployment_job_agent
- Exactly one owner reference is set
- key: variable identifier
- is_sensitive: indicates whether the variable contains sensitive data

---

### **Variable Value**

Represents a candidate value for a variable.

Supports three value types:

- literal: JSON value stored directly
- ref: reference to another variable
- secret_ref: reference to an external secret provider

Also includes:

- resource_selector: optional matching condition
- priority: determines precedence

---

### **Value Types**

### **Literal**

Stores a JSON value directly in the database.

Example:

```
{ "host": "db.internal", "port": 5432 }
```

### **Reference**

References another variable by key, optionally with a path.

Example:

```
{ "ref": "db.config", "path": ["host"] }
```

### **Secret Reference**

References a value stored in an external secret manager.

Example:

```
{
  "provider": "vault",
  "key": "kv/data/prod/db",
  "path": ["password"]
}
```

---

### **Resolution Model**

To resolve a variable:

1. Identify the variable by scope and key
2. Retrieve all associated variable_value rows
3. Filter by selector (if applicable)
4. Sort by priority (descending)
5. Select the highest-priority match
6. Resolve based on value type:
    - literal → return value
    - ref → recursively resolve referenced variable
    - secret_ref → fetch from external provider

---

### **Why This Design**

### **Eliminates Duplication**

- One table for variables instead of per-scope tables
- One table for values instead of per-type tables

### **Extensible**

Adding a new value type (e.g., computed, templated) requires:

- Adding a new enum value
- Adding optional columns or extending logic

No new tables required.

### **Unified Resolution Logic**

All variables follow the same resolution pipeline regardless of scope or type.

### **Secret Handling**

Secrets are treated as a value source, not a separate system:

- Avoids duplicating schema
- Keeps resolution consistent
- Prevents storing sensitive data directly in the DB

---

## **Alternatives Considered**

### **1. Separate Tables per Scope**

Rejected because:

- Leads to schema duplication
- Requires duplicating logic
- Hard to extend

### **2. Separate Tables per Value Type**

Rejected because:

- Introduces join complexity
- Makes adding new types expensive

### **3. Separate Secret Tables**

Rejected because:

- Secrets participate in the same resolution semantics
- Only the value source differs
- Duplication would increase system complexity

---

## **Tradeoffs**

### **Pros**

- Dramatically simpler schema
- Centralized resolution logic
- Easier to extend
- Reduces duplication

### **Cons**

- More nullable columns in variable_value
- Some validation shifts to application logic
- Slightly more complex constraints

---

## **Future Work**

- Replace ref_key with referenced_variable_id for stronger integrity
- Introduce structured selector model (e.g., JSON-based matching)
- Add expression-based value model (single JSON expression column)
- Add audit logging and versioning

---

## **Migration Strategy**

1. Create new tables alongside existing schema
2. Backfill variables and values
3. Update read paths to use new schema
4. Deprecate old tables
5. Remove old schema after validation

---

## **Conclusion**

This proposal replaces a fragmented and duplicated schema with a unified, extensible model for variable management.

By treating scope and value type as data rather than schema, the system becomes:

- Easier to maintain
- Easier to extend
- More consistent in behavior

It also provides a clean path to integrate secrets without introducing additional structural complexity.
