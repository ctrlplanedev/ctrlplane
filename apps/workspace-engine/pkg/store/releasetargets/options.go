package releasetargets

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

type storeConfig struct {
	cacheTTL *time.Duration
}

type Option func(*storeConfig)

func WithCache(ttl time.Duration) Option {
	return func(c *storeConfig) {
		c.cacheTTL = &ttl
	}
}

func buildCache(opts []Option) *gocache.Cache {
	cfg := &storeConfig{}
	for _, o := range opts {
		o(cfg)
	}
	if cfg.cacheTTL == nil {
		return nil
	}
	return gocache.New(*cfg.cacheTTL, *cfg.cacheTTL*2)
}
