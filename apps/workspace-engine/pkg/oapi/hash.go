package oapi

import (
	"encoding/binary"
)

// fnv64a computes FNV-1a hash directly on bytes - extremely fast, no allocations.
func fnv64a(data []byte) uint64 {
	const (
		offset64 = 14695981039346656037
		prime64  = 1099511628211
	)
	hash := uint64(offset64)
	for _, b := range data {
		hash ^= uint64(b)
		hash *= prime64
	}
	return hash
}

func SelectorHash(selector string) string {
	hash := fnv64a([]byte(selector))
	var buf [16]byte
	binary.BigEndian.PutUint64(buf[:8], hash)
	const hextable = "0123456789abcdef"
	var result [16]byte
	for i := range 8 {
		result[i*2] = hextable[buf[i]>>4]
		result[i*2+1] = hextable[buf[i]&0x0f]
	}
	return string(result[:])
}
