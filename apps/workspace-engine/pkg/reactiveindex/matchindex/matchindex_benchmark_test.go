package matchindex

import (
	"context"
	"fmt"
	"hash/fnv"
	"runtime"
	"testing"

	"github.com/google/uuid"
)

var benchSizes = []int{100, 500, 1000, 2000}

// hashMatch deterministically decides whether a (selector, entity) pair matches
// based on a fast hash. ~10% of pairs will match.
func hashMatch(_ context.Context, selectorID, entityID string) (bool, error) {
	h := fnv.New64a()
	h.Write([]byte(selectorID))
	h.Write([]byte{0})
	h.Write([]byte(entityID))
	return h.Sum64()%10 == 0, nil
}

// deterministicUUID generates a deterministic UUID from a namespace and index
// so benchmarks remain reproducible.
func deterministicUUID(namespace string, i int) string {
	return uuid.NewSHA1(uuid.NameSpaceDNS, fmt.Appendf(nil, "%s-%d", namespace, i)).String()
}

// benchIDs holds pre-generated selector and entity UUIDs for a given size.
type benchIDs struct {
	selectors []string
	entities  []string
}

// generateIDs creates n selector UUIDs and n entity UUIDs.
func generateIDs(n int) benchIDs {
	ids := benchIDs{
		selectors: make([]string, n),
		entities:  make([]string, n),
	}
	for i := range n {
		ids.selectors[i] = deterministicUUID("selector", i)
	}
	for i := range n {
		ids.entities[i] = deterministicUUID("entity", i)
	}
	return ids
}

// buildIndex creates a MatchIndex pre-populated with n selectors and n entities,
// all marked dirty and ready for a first Recompute.
func buildIndex(ids benchIDs, eval MatchFunc) *MatchIndex {
	idx := New(eval)
	for _, id := range ids.selectors {
		idx.AddSelector(id)
	}
	for _, id := range ids.entities {
		idx.AddEntity(id)
	}
	return idx
}

// buildAndRecompute creates an index, runs the initial Recompute, and returns
// the settled index.
func buildAndRecompute(ids benchIDs, eval MatchFunc) *MatchIndex {
	idx := buildIndex(ids, eval)
	idx.Recompute(context.Background())
	return idx
}

func BenchmarkRecompute_Initial(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			for b.Loop() {
				b.StopTimer()
				idx := buildIndex(ids, hashMatch)
				b.StartTimer()

				idx.Recompute(context.Background())
			}
		})
	}
}

func BenchmarkRecompute_DirtySingleEntity(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				idx.DirtyEntity(ids.entities[0])
				idx.Recompute(context.Background())
			}
		})
	}
}

func BenchmarkRecompute_DirtySingleSelector(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				idx.UpdateSelector(ids.selectors[0])
				idx.Recompute(context.Background())
			}
		})
	}
}

func BenchmarkRecompute_DirtyAll(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				idx.DirtyAll()
				idx.Recompute(context.Background())
			}
		})
	}
}

// BenchmarkRecompute_WorstCase triggers all three dirty sources simultaneously:
// every selector dirty, every entity dirty, and explicit dirty pairs. The
// dedup logic must skip-check every pair in steps 2 and 3 while still
// evaluating the full n² cross product.
func BenchmarkRecompute_WorstCase(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			runtime.GC()
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			b.ReportMetric(float64(m.Alloc)/(1024*1024*1024), "heap-GB")

			b.ResetTimer()
			for b.Loop() {
				b.StopTimer()
				for _, sel := range ids.selectors {
					idx.UpdateSelector(sel)
				}
				idx.DirtyAll()
				for i := range min(n, 100) {
					idx.DirtyPair(ids.selectors[i], ids.entities[i])
				}
				b.StartTimer()

				idx.Recompute(context.Background())
			}
		})
	}
}

// BenchmarkRecompute_WorstCasePerf measures raw throughput of the worst-case
// full recompute (all n² pairs) and reports ns/pair so scaling is visible
// across sizes. DirtyAll is called inside the timed loop — it is O(n) and
// included intentionally since real workloads pay that cost too.
func BenchmarkRecompute_WorstCasePerf(b *testing.B) {
	sizes := []int{100, 500, 1000, 2000, 5000}

	for _, n := range sizes {
		totalPairs := int64(n) * int64(n)

		b.Run(fmt.Sprintf("n=%d_pairs=%d", n, totalPairs), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			var totalEvals int64
			b.ResetTimer()
			b.ReportAllocs()

			for b.Loop() {
				idx.DirtyAll()
				totalEvals += int64(idx.Recompute(context.Background()))
			}

			b.ReportMetric(float64(b.Elapsed().Nanoseconds())/float64(totalEvals), "ns/pair")
			b.ReportMetric(float64(totalEvals)/b.Elapsed().Seconds(), "pairs/sec")
		})
	}
}

func BenchmarkRecompute_DirtyPair(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				idx.DirtyPair(ids.selectors[0], ids.entities[0])
				idx.Recompute(context.Background())
			}
		})
	}
}

func BenchmarkGetMatches(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				_ = idx.GetMatches(ids.selectors[0])
			}
		})
	}
}

func BenchmarkGetMatchingSelectors(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				_ = idx.GetMatchingSelectors(ids.entities[0])
			}
		})
	}
}

func BenchmarkForEachMatch(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for b.Loop() {
				idx.ForEachMatch(ids.selectors[0], func(_ string) bool {
					return true
				})
			}
		})
	}
}

func BenchmarkAddEntity(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for i := 0; b.Loop(); i++ {
				idx.AddEntity(deterministicUUID("new-entity", i))
			}
		})
	}
}

func BenchmarkAddSelector(b *testing.B) {
	for _, n := range benchSizes {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			ids := generateIDs(n)
			idx := buildAndRecompute(ids, hashMatch)

			b.ResetTimer()
			for i := 0; b.Loop(); i++ {
				idx.AddSelector(deterministicUUID("new-selector", i))
			}
		})
	}
}
