package oapi

import (
	"testing"
)

func TestSelector_Hash(t *testing.T) {
	t.Run("nil selector returns empty string", func(t *testing.T) {
		var s *Selector
		if got := s.Hash(); got != "" {
			t.Errorf("Hash() = %q, want empty string", got)
		}
	})

	t.Run("json selector produces consistent hash", func(t *testing.T) {
		s := &Selector{}
		_ = s.FromJsonSelector(JsonSelector{
			Json: map[string]any{
				"type": "Resource",
				"key":  "metadata.name",
			},
		})

		hash1 := s.Hash()
		hash2 := s.Hash()

		if hash1 != hash2 {
			t.Errorf("Hash() not deterministic: %q != %q", hash1, hash2)
		}
		if len(hash1) != 16 {
			t.Errorf("Hash() length = %d, want 16", len(hash1))
		}
	})

	t.Run("cel selector produces consistent hash", func(t *testing.T) {
		s := &Selector{}
		_ = s.FromCelSelector(CelSelector{
			Cel: "resource.metadata.name == 'test'",
		})

		hash1 := s.Hash()
		hash2 := s.Hash()

		if hash1 != hash2 {
			t.Errorf("Hash() not deterministic: %q != %q", hash1, hash2)
		}
		if len(hash1) != 16 {
			t.Errorf("Hash() length = %d, want 16", len(hash1))
		}
	})

	t.Run("different selectors produce different hashes", func(t *testing.T) {
		s1 := &Selector{}
		_ = s1.FromJsonSelector(JsonSelector{
			Json: map[string]any{"key": "value1"},
		})

		s2 := &Selector{}
		_ = s2.FromJsonSelector(JsonSelector{
			Json: map[string]any{"key": "value2"},
		})

		if s1.Hash() == s2.Hash() {
			t.Error("Different selectors should produce different hashes")
		}
	})

	t.Run("same content produces same hash", func(t *testing.T) {
		s1 := &Selector{}
		_ = s1.FromCelSelector(CelSelector{Cel: "true"})

		s2 := &Selector{}
		_ = s2.FromCelSelector(CelSelector{Cel: "true"})

		if s1.Hash() != s2.Hash() {
			t.Errorf("Same content should produce same hash: %q != %q", s1.Hash(), s2.Hash())
		}
	})

	t.Run("hash contains only hex characters", func(t *testing.T) {
		s := &Selector{}
		_ = s.FromCelSelector(CelSelector{Cel: "resource.kind == 'Pod'"})

		hash := s.Hash()
		for i, c := range hash {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
				t.Errorf("Hash() contains non-hex char %q at position %d", c, i)
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

func BenchmarkSelector_Hash(b *testing.B) {
	s := &Selector{}
	_ = s.FromJsonSelector(JsonSelector{
		Json: map[string]interface{}{
			"type": "Resource",
			"conditions": []interface{}{
				map[string]interface{}{"key": "metadata.name", "operator": "equals", "value": "test"},
				map[string]interface{}{"key": "metadata.namespace", "operator": "equals", "value": "default"},
			},
		},
	})

	b.ResetTimer()
	b.ReportAllocs()
	for range b.N {
		_ = s.Hash()
	}
}

func BenchmarkFnv64a(b *testing.B) {
	data := []byte(`{"type":"Resource","conditions":[{"key":"metadata.name","operator":"equals","value":"test"}]}`)

	b.ResetTimer()
	b.ReportAllocs()
	for range b.N {
		_ = fnv64a(data)
	}
}
