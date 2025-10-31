package gradualrollout

import (
	"errors"
	"sort"
	"workspace-engine/pkg/oapi"
)

type hashingFunc func(*oapi.ReleaseTarget, string) (uint64, error)

type targetWithHash struct {
	target *oapi.ReleaseTarget
	hash   uint64
}

// rolloutPositionBuilder builds and computes rollout positions through a fluent API
type rolloutPositionBuilder struct {
	targets          []*oapi.ReleaseTarget
	hashingFn        hashingFunc
	targetsWithHashes []targetWithHash
	releaseTarget    *oapi.ReleaseTarget
	err              error
}

// newRolloutPositionBuilder creates a new builder for computing rollout positions
func newRolloutPositionBuilder(releaseTargets []*oapi.ReleaseTarget, hashingFn hashingFunc) *rolloutPositionBuilder {
	return &rolloutPositionBuilder{targets: releaseTargets, hashingFn: hashingFn}
}

// computeHashes computes deterministic hashes for each target using the version ID
func (b *rolloutPositionBuilder) computeHashes(
	key string,
) *rolloutPositionBuilder {
	if b.hashingFn == nil {
		b.err = errors.New("hashing function not provided")
		return b
	}

	b.targetsWithHashes = make([]targetWithHash, 0, len(b.targets))
	for _, target := range b.targets {
		hash, err := b.hashingFn(target, key)
		if err != nil {
			b.err = err
			return b
		}
		b.targetsWithHashes = append(b.targetsWithHashes, targetWithHash{
			target: target,
			hash:   hash,
		})
	}

	return b
}

// sortByHash sorts targets by their hash values in ascending order
func (b *rolloutPositionBuilder) sortByHash() *rolloutPositionBuilder {
	sort.Slice(b.targetsWithHashes, func(i, j int) bool {
		return b.targetsWithHashes[i].hash < b.targetsWithHashes[j].hash
	})
	return b
}

// findPosition finds the zero-based position of the target in the sorted list
func (b *rolloutPositionBuilder) findPosition(releaseTarget *oapi.ReleaseTarget) *rolloutPositionBuilder {
	b.releaseTarget = releaseTarget
	return b
}

// build returns the final position and error
func (b *rolloutPositionBuilder) build() (int32, error) {
	if b.err != nil {
		return 0, b.err
	}

	if b.releaseTarget == nil {
		return 0, errors.New("release target not provided")
	}

	targetKey := b.releaseTarget.Key()
	for i, th := range b.targetsWithHashes {
		if th.target.Key() == targetKey {
			return int32(i), nil
		}
	}

	return 0, errors.New("release target not found in sorted list")
}
