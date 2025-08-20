package environmentversionrollout

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"

	rt "workspace-engine/pkg/engine/policy/releasetargets"

	"gotest.tools/assert"
)

func makeReleaseTargetWithID(id int) rt.ReleaseTarget {
	deploymentID := "deployment"
	environmentID := "environment"
	return rt.ReleaseTarget{
		Resource: resource.Resource{
			ID: fmt.Sprintf("resource-%d", id),
		},
		Environment: environment.Environment{
			ID: environmentID,
		},
		Deployment: deployment.Deployment{
			ID: deploymentID,
		},
	}
}

func TestHashedPosition(t *testing.T) {
	releaseTargetRepository := rt.NewReleaseTargetRepository()
	ctx := context.Background()

	releaseTarget1 := makeReleaseTargetWithID(1)
	releaseTarget2 := makeReleaseTargetWithID(2)
	releaseTarget3 := makeReleaseTargetWithID(3)

	releaseTargetRepository.Create(ctx, &releaseTarget1)
	releaseTargetRepository.Create(ctx, &releaseTarget2)
	releaseTargetRepository.Create(ctx, &releaseTarget3)

	version1 := deployment.DeploymentVersion{
		ID: "version-1",
	}

	version2 := deployment.DeploymentVersion{
		ID: "version-2",
	}

	f := getHashedPositionFunction(releaseTargetRepository)

	positionRt1V1Call1, err := f(ctx, releaseTarget1, version1)
	assert.NilError(t, err)
	positionRt2V1Call1, err := f(ctx, releaseTarget2, version1)
	assert.NilError(t, err)
	positionRt3V1Call1, err := f(ctx, releaseTarget3, version1)
	assert.NilError(t, err)

	v1Call1Results := []int{
		positionRt1V1Call1,
		positionRt2V1Call1,
		positionRt3V1Call1,
	}

	positionRt1V1Call2, err := f(ctx, releaseTarget1, version1)
	assert.NilError(t, err)
	positionRt2V1Call2, err := f(ctx, releaseTarget2, version1)
	assert.NilError(t, err)
	positionRt3V1Call2, err := f(ctx, releaseTarget3, version1)
	assert.NilError(t, err)

	v1Call2Results := []int{
		positionRt1V1Call2,
		positionRt2V1Call2,
		positionRt3V1Call2,
	}

	positionRt1V2Call1, err := f(ctx, releaseTarget1, version2)
	assert.NilError(t, err)
	positionRt2V2Call1, err := f(ctx, releaseTarget2, version2)
	assert.NilError(t, err)
	positionRt3V2Call1, err := f(ctx, releaseTarget3, version2)
	assert.NilError(t, err)

	v2Call1Results := []int{
		positionRt1V2Call1,
		positionRt2V2Call1,
		positionRt3V2Call1,
	}

	positionRt1V2Call2, err := f(ctx, releaseTarget1, version2)
	assert.NilError(t, err)
	positionRt2V2Call2, err := f(ctx, releaseTarget2, version2)
	assert.NilError(t, err)
	positionRt3V2Call2, err := f(ctx, releaseTarget3, version2)
	assert.NilError(t, err)

	v2Call2Results := []int{
		positionRt1V2Call2,
		positionRt2V2Call2,
		positionRt3V2Call2,
	}

	assert.DeepEqual(t, v1Call1Results, v1Call2Results)
	assert.DeepEqual(t, v2Call1Results, v2Call2Results)
}

func TestHashedPosition_InvalidReleaseTarget(t *testing.T) {
	releaseTargetRepository := rt.NewReleaseTargetRepository()
	ctx := context.Background()

	f := getHashedPositionFunction(releaseTargetRepository)

	result, err := f(ctx, rt.ReleaseTarget{}, deployment.DeploymentVersion{})
	assert.Equal(t, result, 0)
	assert.ErrorContains(t, err, "release target not found")
}
