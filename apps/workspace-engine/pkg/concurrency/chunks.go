package concurrency


func Chunk[T any](slice []T, chunkSize int) [][]T {
	if chunkSize <= 0 {
		return [][]T{slice}
	}

	if len(slice) == 0 {
		return [][]T{}
	}

	var chunks [][]T
	for i := 0; i < len(slice); i += chunkSize {
		end := min(i + chunkSize, len(slice))
		chunks = append(chunks, slice[i:end])
	}

	return chunks
}

// ProcessInChunks processes a slice in parallel chunks and returns the results in order.
// The processFn is called for each item in a chunk and should return the transformed result and any error.
// maxConcurrency controls the maximum number of goroutines running concurrently.
// If maxConcurrency <= 0, it defaults to the number of chunks (unbounded).
func ProcessInChunks[T any, R any](
	slice []T,
	chunkSize int,
	maxConcurrency int,
	processFn func(item T) (R, error),
) ([]R, error) {
	if len(slice) == 0 {
		return []R{}, nil
	}

	chunks := Chunk(slice, chunkSize)

	type chunkResult struct {
		index int
		items []R
		err   error
	}

	resultsChan := make(chan chunkResult, len(chunks))
	
	// Create semaphore to limit concurrent goroutines
	if maxConcurrency <= 0 {
		maxConcurrency = len(chunks)
	}
	semaphore := make(chan struct{}, maxConcurrency)

	// Process each chunk in a goroutine with concurrency control
	for chunkIdx, chunk := range chunks {
		semaphore <- struct{}{} // Acquire semaphore
		
		go func(idx int, items []T) {
			defer func() { <-semaphore }() // Release semaphore
			
			results := make([]R, 0, len(items))

			for _, item := range items {
				result, err := processFn(item)
				if err != nil {
					resultsChan <- chunkResult{index: idx, err: err}
					return
				}
				results = append(results, result)
			}

			resultsChan <- chunkResult{index: idx, items: results}
		}(chunkIdx, chunk)
	}

	// Collect results
	chunkResults := make([]chunkResult, len(chunks))
	for range chunks {
		result := <-resultsChan
		if result.err != nil {
			return nil, result.err
		}
		chunkResults[result.index] = result
	}
	close(resultsChan)

	// Combine results in order
	totalSize := 0
	for _, cr := range chunkResults {
		totalSize += len(cr.items)
	}

	allResults := make([]R, 0, totalSize)
	for _, cr := range chunkResults {
		allResults = append(allResults, cr.items...)
	}

	return allResults, nil
}