package concurrency

import (
	"context"
	"runtime"

	"go.opentelemetry.io/otel"
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
		maxConcurrency: runtime.GOMAXPROCS(0),
	}
	for _, opt := range opts {
		opt(o)
	}

	chunks := Chunk(slice, o.chunkSize)
	if o.maxConcurrency <= 0 {
		o.maxConcurrency = len(chunks)
	}

	// Create errgroup with context for automatic cancellation on error
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(o.maxConcurrency)

	chunkResults := make([][]R, len(chunks))

	// Process each chunk in a goroutine
	for chunkIdx, chunk := range chunks {
		g.Go(func() error {
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

			chunkResults[chunkIdx] = results

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
