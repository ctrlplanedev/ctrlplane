package crypto

import (
	"strings"
	"testing"
)

const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// tsFixtures are ciphertexts produced by the TypeScript @ctrlplane/secrets
// package using testKey. Any drift from byte-level interop will break these.
var tsFixtures = []struct {
	plaintext  string
	ciphertext string
}{
	{
		plaintext:  "hello",
		ciphertext: "c72e33c634ce0cb81e16e2dea3ae8ece:b8d32739794be620178e9b0c8b314969",
	},
	{
		plaintext:  "",
		ciphertext: "a47023812378a4bf2e3986f931cd7a6d:3ad36d456286bc05ad86a354b0cb6822",
	},
	{
		plaintext:  "a longer plaintext with spaces and punctuation, including 0123456789!",
		ciphertext: "bbd1fb174926cf4d5ee3c71a9020af37:748ddb2465eee4bd20829a37c974086b2ed5b68ec7f55d53beb7a91b1e42025aa4a58e35af5a303d7e5e7ec5ade14ad6708da09189c7c0150d515f9eb9d2d602c735fc7d8ecb3fd36a6f894f6174f12f",
	},
	{
		plaintext:  `{"serviceToken":"dp.st.abcdef","region":"us-east-1"}`,
		ciphertext: "4eddf95c6ed56c14b0a34c66468ffefb:fab54199d89ffc29df9c4ab62160538a4d2f8c4decfcdce8065a0a6334109562982f87e8d364c9b43eb8c54b45e98732d6853cce381f1b1a9b21cd8f1490f3e8",
	},
}

func TestDecryptInteropWithTypeScript(t *testing.T) {
	svc, err := New(testKey)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	for _, f := range tsFixtures {
		got, err := svc.Decrypt(f.ciphertext)
		if err != nil {
			t.Fatalf("Decrypt(%q): %v", f.ciphertext, err)
		}
		if got != f.plaintext {
			t.Fatalf("Decrypt(%q): want %q, got %q", f.ciphertext, f.plaintext, got)
		}
	}
}

func TestRoundTrip(t *testing.T) {
	svc, err := New(testKey)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	cases := []string{
		"",
		"x",
		"hello",
		strings.Repeat("a", 16),
		strings.Repeat("b", 17),
		strings.Repeat("c", 31),
		strings.Repeat("d", 32),
		`{"key":"value","nested":{"a":1}}`,
	}
	for _, c := range cases {
		ct, err := svc.Encrypt(c)
		if err != nil {
			t.Fatalf("Encrypt(%q): %v", c, err)
		}
		if !strings.Contains(ct, ":") {
			t.Fatalf("Encrypt(%q): ciphertext missing iv separator: %s", c, ct)
		}
		pt, err := svc.Decrypt(ct)
		if err != nil {
			t.Fatalf("Decrypt(%q): %v", ct, err)
		}
		if pt != c {
			t.Fatalf("round trip: want %q, got %q", c, pt)
		}
	}
}

func TestEncryptUniqueIV(t *testing.T) {
	svc, err := New(testKey)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	ct1, err := svc.Encrypt("same plaintext")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	ct2, err := svc.Encrypt("same plaintext")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if ct1 == ct2 {
		t.Fatal(
			"two encryptions of the same plaintext produced identical ciphertext (IV not random)",
		)
	}
}

func TestNewRejectsBadKey(t *testing.T) {
	cases := []string{
		"",
		"too short",
		strings.Repeat("z", 64), // not hex
		strings.Repeat("a", 63),
		strings.Repeat("a", 65),
	}
	for _, c := range cases {
		if _, err := New(c); err == nil {
			t.Fatalf("New(%q) expected error", c)
		}
	}
}

func TestDecryptRejectsMalformed(t *testing.T) {
	svc, err := New(testKey)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	cases := []string{
		"",
		"no-separator",
		"deadbeef",
		":onlysepatstart",
		"abc:",
		"zz:zz",
		"00112233445566778899aabbccddeeff:zz",
	}
	for _, c := range cases {
		if _, err := svc.Decrypt(c); err == nil {
			t.Fatalf("Decrypt(%q) expected error", c)
		}
	}
}
