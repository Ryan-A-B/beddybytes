package store

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type EncryptingDecorator struct {
	store Store
	key   []byte
}

type NewEncryptingDecoratorInput struct {
	Store Store
	Key   []byte
}

func NewEncryptingDecorator(input *NewEncryptingDecoratorInput) *EncryptingDecorator {
	return &EncryptingDecorator{
		store: input.Store,
		key:   input.Key,
	}
}

func (decorator *EncryptingDecorator) Put(ctx context.Context, key string, data []byte) (err error) {
	paddedData := decorator.pkcs7Pad(data, aes.BlockSize)
	block, err := aes.NewCipher(decorator.key)
	fatal.OnError(err)
	encryptedData := make([]byte, aes.BlockSize+len(paddedData))
	iv := encryptedData[:aes.BlockSize]
	_, err = io.ReadFull(rand.Reader, iv)
	fatal.OnError(err)
	encrypter := cipher.NewCBCEncrypter(block, encryptedData[:aes.BlockSize])
	encrypter.CryptBlocks(encryptedData[aes.BlockSize:], paddedData)
	return decorator.store.Put(ctx, key, encryptedData)
}

func (decorator *EncryptingDecorator) Get(ctx context.Context, key string) (data []byte, err error) {
	encryptedData, err := decorator.store.Get(ctx, key)
	if err != nil {
		return
	}
	block, err := aes.NewCipher(decorator.key)
	fatal.OnError(err)
	iv := encryptedData[:aes.BlockSize]
	paddedData := make([]byte, len(encryptedData[aes.BlockSize:]))
	encrypter := cipher.NewCBCDecrypter(block, iv)
	encrypter.CryptBlocks(paddedData, encryptedData[aes.BlockSize:])
	data = decorator.pkcs7Unpad(paddedData, aes.BlockSize)
	return
}

func (decorator *EncryptingDecorator) Delete(ctx context.Context, key string) (err error) {
	return decorator.store.Delete(ctx, key)
}

func (decorator *EncryptingDecorator) pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - (len(data) % blockSize)
	padText := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(data, padText...)
}

func (decorator *EncryptingDecorator) pkcs7Unpad(data []byte, blockSize int) []byte {
	length := len(data)
	unpadding := int(data[length-1])
	fatal.Unless(unpadding <= blockSize, "invalid padding")
	fatal.Unless(unpadding > 0, "invalid padding")
	return data[:(length - unpadding)]
}
