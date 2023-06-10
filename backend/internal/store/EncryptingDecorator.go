package store

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"

	"github.com/ryan/baby-monitor/backend/internal/fatal"
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
	block, err := aes.NewCipher(decorator.key)
	fatal.OnError(err)
	encryptedData := make([]byte, aes.BlockSize+len(data))
	iv := encryptedData[:aes.BlockSize]
	_, err = rand.Read(iv)
	fatal.OnError(err)
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(encryptedData[aes.BlockSize:], data)
	return decorator.store.Put(ctx, key, encryptedData)
}

func (decorator *EncryptingDecorator) Get(ctx context.Context, key string) (data []byte, err error) {
	encryptedData, err := decorator.store.Get(ctx, key)
	if err != nil {
		return
	}
	block, err := aes.NewCipher(decorator.key)
	fatal.OnError(err)
	fatal.Unless(len(encryptedData) >= aes.BlockSize, "invalid data")
	iv := encryptedData[:aes.BlockSize]
	encryptedData = encryptedData[aes.BlockSize:]
	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(encryptedData, encryptedData)
	return encryptedData, nil
}

func (decorator *EncryptingDecorator) Delete(ctx context.Context, key string) (err error) {
	return decorator.store.Delete(ctx, key)
}
