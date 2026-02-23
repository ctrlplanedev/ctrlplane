package tickerloop

import (
	"context"
	"time"
)

func Every(ctx context.Context, interval time.Duration, fn func(ctx context.Context)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			fn(ctx)
		case <-ctx.Done():
			return
		}
	}
}
