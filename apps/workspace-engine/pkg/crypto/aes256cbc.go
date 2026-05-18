// Package crypto provides AES-256-CBC encryption matching the format produced
// by the TypeScript @ctrlplane/secrets package. Both sides use a 32-byte key
// (encoded as 64 hex characters) and emit ciphertext in the form
// "<iv-hex>:<ciphertext-hex>" with PKCS#7 padding.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const (
	keyHexLength = 64
	keyByteLen   = 32
	ivByteLen    = 16
)

// AES256CBC encrypts and decrypts strings using AES-256-CBC. The key must be
// supplied as a 64-character hex string (32 bytes decoded).
type AES256CBC struct {
	key []byte
}

// New constructs an AES256CBC from a 64-character hex key.
func New(keyHex string) (*AES256CBC, error) {
	if len(keyHex) != keyHexLength {
		return nil, fmt.Errorf(
			"aes256cbc: key must be %d hex characters, got %d",
			keyHexLength,
			len(keyHex),
		)
	}
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return nil, fmt.Errorf("aes256cbc: invalid hex key: %w", err)
	}
	if len(key) != keyByteLen {
		return nil, fmt.Errorf(
			"aes256cbc: decoded key must be %d bytes, got %d",
			keyByteLen,
			len(key),
		)
	}
	return &AES256CBC{key: key}, nil
}

// Encrypt returns the ciphertext for plaintext in the format used by
// @ctrlplane/secrets: "<iv-hex>:<ciphertext-hex>".
func (a *AES256CBC) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(a.key)
	if err != nil {
		return "", fmt.Errorf("aes256cbc: cipher init: %w", err)
	}
	iv := make([]byte, ivByteLen)
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("aes256cbc: iv generation: %w", err)
	}
	padded := pkcs7Pad([]byte(plaintext), block.BlockSize())
	encrypted := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(encrypted, padded)
	return hex.EncodeToString(iv) + ":" + hex.EncodeToString(encrypted), nil
}

// Decrypt reverses Encrypt. It accepts ciphertexts produced by either the Go
// implementation or the TypeScript @ctrlplane/secrets package.
func (a *AES256CBC) Decrypt(ciphertext string) (string, error) {
	ivHex, encHex, ok := strings.Cut(ciphertext, ":")
	if !ok {
		return "", errors.New("aes256cbc: invalid encrypted data")
	}
	iv, err := hex.DecodeString(ivHex)
	if err != nil {
		return "", fmt.Errorf("aes256cbc: invalid iv: %w", err)
	}
	if len(iv) != ivByteLen {
		return "", fmt.Errorf("aes256cbc: iv must be %d bytes, got %d", ivByteLen, len(iv))
	}
	enc, err := hex.DecodeString(encHex)
	if err != nil {
		return "", fmt.Errorf("aes256cbc: invalid ciphertext: %w", err)
	}
	block, err := aes.NewCipher(a.key)
	if err != nil {
		return "", fmt.Errorf("aes256cbc: cipher init: %w", err)
	}
	if len(enc) == 0 || len(enc)%block.BlockSize() != 0 {
		return "", errors.New("aes256cbc: ciphertext length is not a multiple of block size")
	}
	decrypted := make([]byte, len(enc))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(decrypted, enc)
	unpadded, err := pkcs7Unpad(decrypted, block.BlockSize())
	if err != nil {
		return "", err
	}
	return string(unpadded), nil
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padLen := blockSize - len(data)%blockSize
	padded := make([]byte, len(data)+padLen)
	copy(padded, data)
	for i := len(data); i < len(padded); i++ {
		padded[i] = byte(padLen)
	}
	return padded
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 || len(data)%blockSize != 0 {
		return nil, errors.New("aes256cbc: padded data is not a multiple of block size")
	}
	padLen := int(data[len(data)-1])
	if padLen == 0 || padLen > blockSize {
		return nil, errors.New("aes256cbc: invalid padding length")
	}
	for i := len(data) - padLen; i < len(data); i++ {
		if int(data[i]) != padLen {
			return nil, errors.New("aes256cbc: invalid padding bytes")
		}
	}
	return data[:len(data)-padLen], nil
}
