# Ctrlplane E2E Tests

This directory contains end-to-end tests for the Ctrlplane platform. The tests use Playwright and are organized by domain area and functionality.

## Test Organization

The tests are categorized into:

1. **API Tests**: Located in the `tests/api/` directory, testing backend API functionality
2. **UI Tests**: Located directly in the `tests/` directory, testing frontend UI functionality

### API Tests

API tests are further organized by resource type:

- `tests/api/environments.spec.ts` - Environment-related API endpoints
- `tests/api/resource-selectors.spec.ts` - Resource selector functionality
- `tests/api/resources.spec.ts` - Resource management endpoints
- `tests/api/yaml-import.spec.ts` - YAML entity import functionality
- `tests/api/random-prefix-yaml.spec.ts` - YAML import with random prefixes
- `tests/api/template-yaml.spec.ts` - YAML import with template processing
- `tests/api/policies/` - Policy-related API endpoints
  - `tests/api/policies/release-targets.spec.ts` - Policy release target functionality
  - `tests/api/policies/policies.spec.ts` - Core policy functionality

### UI Tests

- `tests/systems.spec.ts` - System management via UI and API

## Test Utilities

Helper functions for test setup are located in:

- `api/utils.ts` - Contains modular utility functions for creating test resources
- `api/yaml-loader.ts` - Utilities for importing test entities from YAML files
- `tests/fixtures.ts` - Defines test fixtures for workspace and API access
- `tests/fixtures/*.yaml` - YAML fixture files for test data

### YAML Entity Loader

The YAML Entity Loader allows you to define entire test environments in YAML files and import them with a single function call. This makes it easy to create complex test scenarios with multiple related entities.

Example usage:

```typescript
import {
  cleanupImportedEntities,
  importEntitiesFromYaml,
} from "../../api/yaml-loader";

// In a beforeAll hook - basic import
const yamlPath = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "test-system.yaml",
);
const entities = await importEntitiesFromYaml(api, workspace.id, yamlPath);

// Or with a random prefix to avoid naming conflicts
const prefixedEntities = await importEntitiesFromYaml(
  api, 
  workspace.id, 
  yamlPath,
  {
    addRandomPrefix: true,     // Add a random prefix to all entities
    updateSelectors: true      // Update resource selectors to use the prefix
  }
);

// With a custom prefix
const customEntities = await importEntitiesFromYaml(
  api,
  workspace.id,
  yamlPath,
  {
    customPrefix: "my-unique-prefix",
    updateSelectors: true
  }
);

// In tests, use the imported entities
test("test something", async ({ api }) => {
  const systemId = entities.system.id;
  // ... test using the imported entities
});

// In afterAll hook, clean up
await cleanupImportedEntities(api, entities);
```

### Random Prefixes

The YAML entity loader supports adding random or custom prefixes to avoid naming conflicts. This is particularly useful when:

1. Running tests in parallel
2. Running the same test multiple times
3. Working in a shared test environment

Options include:

- `addRandomPrefix: true` - Automatically adds a timestamp + random string prefix
- `customPrefix: "my-prefix"` - Uses your own custom prefix
- `updateSelectors: true` - Updates resource selectors to work with the prefixed entity names

When using prefixes, the imported entities contain both the prefixed names and the original names:

```typescript
// Example of a prefixed entity
{
  prefix: "test-1682542981234-a1b2c3",
  system: {
    id: "123-456",
    name: "test-1682542981234-a1b2c3-yaml-test-system",
    slug: "test-1682542981234-a1b2c3-yaml-test-system",
    originalName: "yaml-test-system"
  },
  // ...other entities with similar structure
}
```

### Template Engine

The YAML entity loader supports a template engine that lets you use dynamic values in your YAML files. This is useful for:

1. Creating unique identifiers for each test run
2. Generating random test data
3. Making YAML fixtures more reusable

Templates use Mustache syntax with double curly braces: `{{ functionName() }}`

Example YAML with templates:

```yaml
system:
  name: "test-system-{{ runid() }}"
  slug: "test-{{ slug('System ' + timestamp()) }}"

resources:
  - name: "api-server-{{ randomString(5) }}"
    identifier: "{{ runid('resource') }}-api"
    version: "v1"
    config:
      replicas: {{ random(1, 5) }}
```

Available template functions:

- `{{ runid([prefix]) }}` - Generate a unique run ID (timestamp + random number)
- `{{ uuid() }}` - Generate a UUID v4
- `{{ timestamp() }}` - Get current timestamp
- `{{ random(min, max) }}` - Generate a random number between min and max
- `{{ randomString(length) }}` - Generate a random alphanumeric string
- `{{ randomName([prefix]) }}` - Generate a random name
- `{{ slug(text) }}` - Convert text to a slug (lowercase, hyphenated)

To use templates, set the `processTemplates` option to true (enabled by default):

```typescript
const entities = await importEntitiesFromYaml(
  api, 
  workspace.id, 
  yamlPath,
  {
    processTemplates: true // Default is true
  }
);
```

You can also define custom template helpers:

```typescript
const entities = await importEntitiesFromYaml(
  api, 
  workspace.id, 
  yamlPath,
  {
    templateHelpers: {
      environment: () => process.env.NODE_ENV || 'test',
      customPrefix: () => 'my-prefix'
    }
  }
);
```

### YAML File Structure

YAML files should be structured as follows:

```yaml
system:
  name: test-system
  slug: test-system
  description: Test system

environments:
  - name: Production
    description: Production environment
    metadata:
      env: prod

resources:
  - name: Resource 1
    kind: TestResource
    identifier: test-resource-1
    version: v1
    config:
      key: value
    metadata:
      env: prod

deployments:
  - name: API Deployment
    slug: api-deployment
    description: API deployment

policies:
  - name: Production Policy
    targets:
      - environmentSelector:
          type: metadata
          operator: equals
          key: env
          value: prod
```

## Running Tests

To run all tests:

```bash
pnpm test
```

To run API tests:

```bash
pnpm test:api
```

To run the YAML import tests:

```bash
pnpm test:yaml            # Basic YAML import
pnpm test:yaml-prefixed   # YAML import with random prefix
pnpm test:yaml-template   # YAML import with template processing
```

To run a specific test file:

```bash
pnpm exec playwright test tests/api/resources.spec.ts
```

To run in debug mode:

```bash
pnpm test:debug
```

## Test Design Principles

1. **Isolation**: Each test should be independent and not rely on state from other tests
2. **Modularity**: Use utility functions to create test resources
3. **Clear assertions**: Each test should have clear expectations
4. **Descriptive naming**: Test names should clearly describe what they're testing
5. **Specific fixtures**: Use YAML files or utility functions to create dedicated test data

## Configuration

Playwright configuration is in `playwright.config.ts`, which sets up:

- Browser environments
- Authentication setup
- Parallelization
- Web server management