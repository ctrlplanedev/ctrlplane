package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"workspace-engine/pkg/config"

	"github.com/charmbracelet/log"
)

const AES_256_PREFIX = "aes256:"

type Encryption interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

type AES256Encryption struct {
	gcm cipher.AEAD
}

func NewEncryption() Encryption {
	keyStr := config.Global.AES256Key
	if keyStr == "" {
		log.Error("AES_256_KEY is not set, using noop encryption")
		return &NoopEncryption{}
	}

	if len(keyStr) != 32 {
		log.Error("AES_256_KEY must be 32 bytes, using noop encryption")
		return &NoopEncryption{}
	}

	key := []byte(keyStr)
	block, err := aes.NewCipher(key)
	if err != nil {
		log.Error("failed to create cipher: %w", err)
		return &NoopEncryption{}
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		log.Error("failed to create GCM: %w", err)
		return &NoopEncryption{}
	}

	return &AES256Encryption{gcm: gcm}
}

// Encrypt encrypts plaintext and returns base64-encoded ciphertext with aes256: prefix
func (e *AES256Encryption) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, e.gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := e.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return AES_256_PREFIX + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded ciphertext (with aes256: prefix) and returns plaintext
func (e *AES256Encryption) Decrypt(ciphertext string) (string, error) {
	if !strings.HasPrefix(ciphertext, AES_256_PREFIX) {
		return "", fmt.Errorf("invalid ciphertext: missing %s prefix", AES_256_PREFIX)
	}

	encoded := strings.TrimPrefix(ciphertext, AES_256_PREFIX)
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	nonceSize := e.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, encrypted := data[:nonceSize], data[nonceSize:]
	plaintext, err := e.gcm.Open(nil, nonce, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

type NoopEncryption struct {
}

func NewNoopEncryption() Encryption {
	return &NoopEncryption{}
}

func (e *NoopEncryption) Encrypt(plaintext string) (string, error) {
	return plaintext, nil
}

func (e *NoopEncryption) Decrypt(ciphertext string) (string, error) {
	return ciphertext, nil
}
