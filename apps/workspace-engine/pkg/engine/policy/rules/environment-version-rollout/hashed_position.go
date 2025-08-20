package environmentversionrollout

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/model/deployment"
)

type releaseTargetWithHash struct {
	rt.ReleaseTarget
	hash string
}

func getHashedPositionFunction(
	releaseTargetRepository *rt.ReleaseTargetRepository,
) func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
	return func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (int, error) {
		environmentID := target.Environment.GetID()
		deploymentID := target.Deployment.GetID()

		allReleaseTargets := releaseTargetRepository.GetAllForDeploymentAndEnvironment(ctx, deploymentID, environmentID)
		releaseTargetsWithHashes := make([]releaseTargetWithHash, len(allReleaseTargets))
		for i, releaseTargetPtr := range allReleaseTargets {
			if releaseTargetPtr == nil {
				return 0, fmt.Errorf("release target is nil")
			}
			releaseTarget := *releaseTargetPtr
			hashInput := fmt.Sprintf("%s-%s", releaseTarget.GetID(), version.GetID())
			hash := sha256.Sum256([]byte(hashInput))
			hashString := hex.EncodeToString(hash[:])
			releaseTargetsWithHashes[i] = releaseTargetWithHash{
				ReleaseTarget: releaseTarget,
				hash:          hashString,
			}
		}

		sort.Slice(releaseTargetsWithHashes, func(i, j int) bool {
			return releaseTargetsWithHashes[i].hash < releaseTargetsWithHashes[j].hash
		})

		for i, releaseTargetWithHash := range releaseTargetsWithHashes {
			if releaseTargetWithHash.GetID() == target.GetID() {
				return i, nil
			}
		}

		return 0, fmt.Errorf("release target not found")
	}
}
