package concurrency

import (
	"context"
	"runtime"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/errgroup"
)

func Chunk[T any](slice []T, chunkSize int) [][]T {
	if chunkSize <= 0 {
		return [][]T{slice}
	}

	if len(slice) == 0 {
		return [][]T{}
	}

	var chunks [][]T
	for i := 0; i < len(slice); i += chunkSize {
		end := min(i+chunkSize, len(slice))
		chunks = append(chunks, slice[i:end])
	}

	return chunks
}

var tracer = otel.Tracer("workspace-engine/pkg/concurrency")

type options struct {
	chunkSize      int
	maxConcurrency int
}

type Option func(*options)

func WithChunkSize(chunkSize int) Option {
	return func(o *options) {
		o.chunkSize = chunkSize
	}
}

func WithMaxConcurrency(maxConcurrency int) Option {
	return func(o *options) {
		o.maxConcurrency = maxConcurrency
	}
}

// ProcessInChunks processes a slice in parallel chunks and returns the results in order.
// The processFn is called for each item in a chunk and should return the transformed result and any error.
// maxConcurrency controls the maximum number of goroutines running concurrently.
// If maxConcurrency <= 0, it defaults to the number of chunks (unbounded).
func ProcessInChunks[T any, R any](
	ctx context.Context,
	slice []T,
	processFn func(ctx context.Context, item T) (R, error),
	opts ...Option,
) ([]R, error) {
	if len(slice) == 0 {
		return []R{}, nil
	}

	o := &options{
		chunkSize:      100,
		maxConcurrency: runtime.NumCPU(),
	}
	for _, opt := range opts {
		opt(o)
	}

	chunks := Chunk(slice, o.chunkSize)

	// Create errgroup with context for automatic cancellation on error
	g, ctx := errgroup.WithContext(ctx)

	// Set concurrency limit
	if o.maxConcurrency <= 0 {
		o.maxConcurrency = len(chunks)
	}
	g.SetLimit(o.maxConcurrency)

	// Store results by chunk index to preserve order
	chunkResults := make([][]R, len(chunks))
	var mu sync.Mutex

	// Process each chunk in a goroutine
	for chunkIdx, chunk := range chunks {
		g.Go(func() error {
			ctx, span := tracer.Start(ctx, "ProcessChunk")
			span.SetAttributes(
				attribute.Int("chunk.index", chunkIdx),
				attribute.Int("chunk.size", len(chunk)),
			)
			defer span.End()

			results := make([]R, 0, len(chunk))

			for _, item := range chunk {
				// Check context cancellation before processing
				select {
				case <-ctx.Done():
					return ctx.Err()
				default:
				}

				result, err := processFn(ctx, item)
				if err != nil {
					return err
				}
				results = append(results, result)
			}

			// Store results for this chunk
			mu.Lock()
			chunkResults[chunkIdx] = results
			mu.Unlock()

			return nil
		})
	}

	// Wait for all goroutines to complete
	if err := g.Wait(); err != nil {
		return nil, err
	}

	// Combine results in order
	totalSize := 0
	for _, cr := range chunkResults {
		totalSize += len(cr)
	}

	allResults := make([]R, 0, totalSize)
	for _, cr := range chunkResults {
		allResults = append(allResults, cr...)
	}

	return allResults, nil
}
