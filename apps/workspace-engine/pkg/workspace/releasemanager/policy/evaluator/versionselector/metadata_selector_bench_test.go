package versionselector

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/google/cel-go/cel"
)

// Benchmark suite for CEL selector evaluation over deployment version metadata.
//
// Scope (v1): metadata-only selectors. Other shapes (tag equality, nested
// access, temporal, collection macros) are intentionally out of scope.
//
// Run:
//   go test -bench=MetadataSelector -benchmem \
//     ./pkg/workspace/releasemanager/policy/evaluator/versionselector/...
//
// Compare runs with benchstat:
//   go test -bench=MetadataSelector -count=5 ... > new.txt
//   benchstat old.txt new.txt

type metadataSelectorShape struct {
	label string
	expr  string
}

var metadataSelectorShapes = []metadataSelectorShape{
	{"eq", `version.metadata["env"] == "prod"`},
	{"missing", `version.metadata["absent"] == "x"`},
	{"presence", `"env" in version.metadata`},
	{"multi_and", `version.metadata["env"] == "prod" && version.metadata["region"] == "us-east-1"`},
	{"string_op", `version.metadata["version"].startsWith("1.")`},
}

var benchCorpusSizes = []int{1_000, 10_000, 100_000}

var benchMapSizes = []struct {
	label string
	keys  int
}{
	{"small", 5},
	{"large", 50},
}

// genVersionContexts builds a deterministic corpus of pre-materialized CEL
// contexts (one per version). Pre-materializing skips the celutil.EntityToMap
// JSON round-trip so the benchmark isolates CEL evaluation cost.
//
// Every version has env/region/version keys; `env="prod"` and
// `region="us-east-1"` hit at matchRate independently so multi_and selectivity
// composes predictably. Extra filler keys pad metadata to mapSize total keys.
func genVersionContexts(n, mapSize int, matchRate float64, seed int64) []map[string]any {
	r := rand.New(rand.NewSource(seed))
	contexts := make([]map[string]any, n)

	for i := range n {
		meta := make(map[string]any, mapSize)

		if r.Float64() < matchRate {
			meta["env"] = "prod"
		} else {
			meta["env"] = "dev"
		}
		if r.Float64() < matchRate {
			meta["region"] = "us-east-1"
		} else {
			meta["region"] = "eu-west-1"
		}
		if r.Float64() < matchRate {
			meta["version"] = fmt.Sprintf("1.%d.%d", r.Intn(100), r.Intn(100))
		} else {
			meta["version"] = fmt.Sprintf("2.%d.%d", r.Intn(100), r.Intn(100))
		}

		for k := range mapSize - len(meta) {
			meta[fmt.Sprintf("filler_%d", k)] = fmt.Sprintf("value_%d", r.Intn(1_000_000))
		}

		contexts[i] = map[string]any{
			"version":     map[string]any{"metadata": meta},
			"environment": map[string]any{},
			"resource":    map[string]any{},
			"deployment":  map[string]any{},
		}
	}

	return contexts
}

// BenchmarkMetadataSelector_Eval measures steady-state evaluation cost with
// a pre-compiled CEL program and pre-materialized version contexts. This is
// the number that matters for "how long to filter N versions" in prod.
func BenchmarkMetadataSelector_Eval(b *testing.B) {
	for _, shape := range metadataSelectorShapes {
		program, err := compile(shape.expr)
		if err != nil {
			b.Fatalf("compile %q: %v", shape.label, err)
		}

		for _, ms := range benchMapSizes {
			for _, n := range benchCorpusSizes {
				name := fmt.Sprintf("shape=%s/keys=%s/n=%d", shape.label, ms.label, n)
				b.Run(name, func(b *testing.B) {
					contexts := genVersionContexts(n, ms.keys, 0.5, 42)

					b.ReportAllocs()
					b.ResetTimer()

					var matches int
					for range b.N {
						matches = 0
						for _, ctx := range contexts {
							ok, _ := evaluate(program, ctx)
							if ok {
								matches++
							}
						}
					}

					b.StopTimer()
					b.ReportMetric(
						float64(n)*float64(b.N)/b.Elapsed().Seconds(),
						"versions/sec",
					)
					_ = matches
				})
			}
		}
	}
}

// BenchmarkMetadataSelector_NativeEq is the hand-written Go equivalent of the
// `eq` shape. Ratio of Eval[shape=eq]/NativeEq is the "CEL overhead factor" —
// a more interpretable number than raw ns/op.
func BenchmarkMetadataSelector_NativeEq(b *testing.B) {
	for _, ms := range benchMapSizes {
		for _, n := range benchCorpusSizes {
			name := fmt.Sprintf("keys=%s/n=%d", ms.label, n)
			b.Run(name, func(b *testing.B) {
				contexts := genVersionContexts(n, ms.keys, 0.5, 42)

				b.ReportAllocs()
				b.ResetTimer()

				var matches int
				for range b.N {
					matches = 0
					for _, ctx := range contexts {
						meta := ctx["version"].(map[string]any)["metadata"].(map[string]any)
						if v, ok := meta["env"].(string); ok && v == "prod" {
							matches++
						}
					}
				}

				b.StopTimer()
				b.ReportMetric(
					float64(n)*float64(b.N)/b.Elapsed().Seconds(),
					"versions/sec",
				)
				_ = matches
			})
		}
	}
}

// BenchmarkMetadataSelector_Compile measures compile-only cost, bypassing the
// ristretto cache in compiledEnv by building a fresh env per run. Useful to
// size cache-miss impact separately from the steady-state Eval cost.
func BenchmarkMetadataSelector_Compile(b *testing.B) {
	for _, shape := range metadataSelectorShapes {
		b.Run("shape="+shape.label, func(b *testing.B) {
			b.ReportAllocs()
			var prg cel.Program
			for range b.N {
				var err error
				prg, err = compileUncached(shape.expr)
				if err != nil {
					b.Fatal(err)
				}
			}
			_ = prg
		})
	}
}

// compileUncached bypasses the ristretto cache so BenchmarkMetadataSelector_Compile
// measures actual CEL compilation, not cache hits.
func compileUncached(expression string) (cel.Program, error) {
	env := compiledEnv.Env()
	ast, iss := env.Compile(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}
	return env.Program(ast)
}
