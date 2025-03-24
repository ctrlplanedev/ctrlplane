import { describe, expect, it } from 'vitest';
import { SequentialUpgradeRule } from '../sequential-upgrade-rule';
import type { DeploymentResourceContext, Release } from '../../types';

describe('SequentialUpgradeRule', () => {
  // Create test releases with different creation times
  const createTestReleases = () => {
    const releases: Release[] = [
      {
        id: 'release-1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        version: {
          tag: '1.0.0',
          config: '{}',
          metadata: {
            // Not marked as requiring sequential upgrade
          },
          statusHistory: {},
        },
        variables: {},
      },
      {
        id: 'release-2',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        version: {
          tag: '1.1.0',
          config: '{}',
          metadata: {
            // This one requires sequential upgrade
            requiresSequentialUpgrade: 'true',
          },
          statusHistory: {},
        },
        variables: {},
      },
      {
        id: 'release-3',
        createdAt: new Date('2024-02-01T10:00:00Z'),
        version: {
          tag: '1.2.0',
          config: '{}',
          metadata: {
            // Not marked as requiring sequential upgrade
          },
          statusHistory: {},
        },
        variables: {},
      },
      {
        id: 'release-4',
        createdAt: new Date('2024-02-15T10:00:00Z'),
        version: {
          tag: '2.0.0',
          config: '{}',
          metadata: {
            // This one requires sequential upgrade
            requiresSequentialUpgrade: 'true',
          },
          statusHistory: {},
        },
        variables: {},
      },
      {
        id: 'release-5',
        createdAt: new Date('2024-03-01T10:00:00Z'),
        version: {
          tag: '2.1.0',
          config: '{}',
          metadata: {
            // Not marked as requiring sequential upgrade
          },
          statusHistory: {},
        },
        variables: {},
      },
    ];
    return releases;
  };

  it('allows all releases when no sequential upgrade is required', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-5', // Latest release
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    // Skip releases with sequential upgrade flag
    const nonSequentialReleases = releases.filter(r => 
      r.version.metadata.requiresSequentialUpgrade !== 'true'
    );
    
    const rule = new SequentialUpgradeRule();

    // Act
    const result = rule.filter(context, nonSequentialReleases);

    // Assert
    expect(result.allowedReleases).toEqual(nonSequentialReleases);
    expect(result.reason).toBeUndefined();
  });

  it('allows direct upgrade to desired release when no intermediate sequential releases exist', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-5', // Latest release
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    // Current version is after all sequential releases
    const currentReleases = [releases[3], releases[4]]; // releases 4 and 5
    
    const rule = new SequentialUpgradeRule();

    // Act
    const result = rule.filter(context, currentReleases);

    // Assert
    expect(result.allowedReleases).toEqual(currentReleases);
    expect(result.reason).toBeUndefined();
  });
  
  it('enforces sequential releases when no desired release is specified', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: '', // No specific desired release - rule engine would pick newest
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    const rule = new SequentialUpgradeRule();

    // Act
    const result = rule.filter(context, releases);

    // Assert
    expect(result.allowedReleases).toHaveLength(1);
    expect(result.allowedReleases[0].id).toBe('release-2'); // Should choose release-2 as it's the oldest sequential release
    expect(result.reason).toContain('requires sequential upgrade');
  });

  it('enforces upgrade to sequential release before desired release', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-5', // Latest release
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    // Current version is before a sequential release
    const currentReleases = [releases[1], releases[2], releases[3], releases[4]]; // releases 2-5
    
    const rule = new SequentialUpgradeRule();

    // Act
    const result = rule.filter(context, currentReleases);

    // Assert
    expect(result.allowedReleases).toHaveLength(1);
    expect(result.allowedReleases[0].id).toBe('release-2'); // Should choose release-2 as it's the oldest sequential release
    expect(result.reason).toContain('requires sequential upgrade');
  });

  it('selects the oldest sequential release when multiple exist', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-5', // Latest release
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    // All releases are available
    const rule = new SequentialUpgradeRule();

    // Act
    const result = rule.filter(context, releases);

    // Assert
    expect(result.allowedReleases).toHaveLength(1);
    expect(result.allowedReleases[0].id).toBe('release-2'); // Should choose release-2 as it's the oldest sequential release
    expect(result.reason).toContain('requires sequential upgrade');
  });

  it('allows desired release if it is the sequential release', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-4', // Release 4 requires sequential upgrade
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    const rule = new SequentialUpgradeRule();

    // Act
    const result = rule.filter(context, releases);

    // Assert - should allow all releases since the desired release is the sequential one
    expect(result.allowedReleases).toEqual(releases);
    expect(result.reason).toBeUndefined();
  });

  it('ignores timestamp checks when configured', () => {
    // Arrange
    const releases = createTestReleases();
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-1', // Oldest release
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    // Configure rule to ignore timestamps
    const rule = new SequentialUpgradeRule({ checkTimestamps: false });

    // Act
    const result = rule.filter(context, releases);

    // Assert - should enforce oldest sequential release (release-2)
    expect(result.allowedReleases).toHaveLength(1);
    expect(result.allowedReleases[0].id).toBe('release-2'); // Should choose release-2 as it's the oldest sequential release
    expect(result.reason).toContain('must be applied sequentially');
  });

  it('works with custom metadata key and value', () => {
    // Arrange
    const releases = [...createTestReleases()];
    
    // Change metadata keys and values
    releases[1].version.metadata = {
      mustApplySequentially: 'yes'
    };
    releases[3].version.metadata = {
      mustApplySequentially: 'yes'
    };
    
    const context: DeploymentResourceContext = {
      desiredReleaseId: 'release-5', // Latest release
      deployment: { id: 'deployment-1', name: 'test-deployment' },
      resource: { id: 'resource-1', name: 'test-resource' },
      environment: { id: 'env-1', name: 'test-environment' },
      availableReleases: releases,
    };
    
    // Configure rule with custom key and value
    const rule = new SequentialUpgradeRule({ 
      metadataKey: 'mustApplySequentially',
      requiredValue: 'yes'
    });

    // Act
    const result = rule.filter(context, releases);

    // Assert
    expect(result.allowedReleases).toHaveLength(1);
    expect(result.allowedReleases[0].id).toBe('release-4'); // Should still choose release-4
    expect(result.reason).toContain('requires sequential upgrade');
  });
});