package oapi

import (
	"testing"
)

func TestSelectorHash(t *testing.T) {
	t.Run("empty string returns consistent hash", func(t *testing.T) {
		hash := SelectorHash("")
		if len(hash) != 16 {
			t.Errorf("SelectorHash() length = %d, want 16", len(hash))
		}
	})

	t.Run("produces consistent hash", func(t *testing.T) {
		hash1 := SelectorHash("resource.metadata.name == 'test'")
		hash2 := SelectorHash("resource.metadata.name == 'test'")

		if hash1 != hash2 {
			t.Errorf("SelectorHash() not deterministic: %q != %q", hash1, hash2)
		}
		if len(hash1) != 16 {
			t.Errorf("SelectorHash() length = %d, want 16", len(hash1))
		}
	})

	t.Run("different selectors produce different hashes", func(t *testing.T) {
		h1 := SelectorHash("resource.kind == 'Pod'")
		h2 := SelectorHash("resource.kind == 'Service'")

		if h1 == h2 {
			t.Error("Different selectors should produce different hashes")
		}
	})

	t.Run("same content produces same hash", func(t *testing.T) {
		h1 := SelectorHash("true")
		h2 := SelectorHash("true")

		if h1 != h2 {
			t.Errorf("Same content should produce same hash: %q != %q", h1, h2)
		}
	})

	t.Run("hash contains only hex characters", func(t *testing.T) {
		hash := SelectorHash("resource.kind == 'Pod'")
		for i, c := range hash {
			if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
				t.Errorf("SelectorHash() contains non-hex char %q at position %d", c, i)
			}
		}
	})
}

func TestFnv64a(t *testing.T) {
	t.Run("empty input", func(t *testing.T) {
		hash := fnv64a([]byte{})
		if hash == 0 {
			t.Error("fnv64a should not return 0 for empty input")
		}
	})

	t.Run("deterministic", func(t *testing.T) {
		data := []byte("test data")
		hash1 := fnv64a(data)
		hash2 := fnv64a(data)
		if hash1 != hash2 {
			t.Errorf("fnv64a not deterministic: %d != %d", hash1, hash2)
		}
	})

	t.Run("different inputs produce different hashes", func(t *testing.T) {
		hash1 := fnv64a([]byte("hello"))
		hash2 := fnv64a([]byte("world"))
		if hash1 == hash2 {
			t.Error("Different inputs should produce different hashes")
		}
	})
}

func BenchmarkSelectorHash(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		_ = SelectorHash("resource.kind == 'Pod' && resource.metadata.namespace == 'default'")
	}
}

func BenchmarkFnv64a(b *testing.B) {
	data := []byte(
		`resource.kind == 'Pod' && resource.metadata.namespace == 'default'`,
	)

	b.ReportAllocs()
	for b.Loop() {
		_ = fnv64a(data)
	}
}
