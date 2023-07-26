package store

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

type S3Store struct {
	client *s3.Client
	bucket string
	prefix string
}

type NewS3StoreInput struct {
	Client *s3.Client
	Bucket string
	Prefix string
}

func NewS3Store(input *NewS3StoreInput) *S3Store {
	return &S3Store{
		client: input.Client,
		bucket: input.Bucket,
		prefix: input.Prefix,
	}
}

func (store *S3Store) getObjectKey(key string) string {
	hash := sha256.New()
	io.WriteString(hash, key)
	sum := hash.Sum(nil)
	return store.prefix + hex.EncodeToString(sum)
}

func (store *S3Store) notFoundOrFatal(err error) error {
	var noSuchKey *types.NoSuchKey
	fatal.Unless(errors.As(err, &noSuchKey), "unexpected error: "+err.Error())
	return ErrNotFound.WithCause(err)
}

func (store *S3Store) Put(ctx context.Context, key string, data []byte) (err error) {
	objectKey := store.getObjectKey(key)
	_, err = store.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: &store.bucket,
		Key:    &objectKey,
		Body:   bytes.NewReader(data),
	})
	fatal.OnError(err)
	return
}

func (store *S3Store) Get(ctx context.Context, key string) (data []byte, err error) {
	objectKey := store.getObjectKey(key)
	output, err := store.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &store.bucket,
		Key:    &objectKey,
	})
	if err != nil {
		err = store.notFoundOrFatal(err)
		return
	}
	defer output.Body.Close()
	data, err = io.ReadAll(output.Body)
	fatal.OnError(err)
	return
}

func (store *S3Store) Delete(ctx context.Context, key string) (err error) {
	objectKey := store.getObjectKey(key)
	_, err = store.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: &store.bucket,
		Key:    &objectKey,
	})
	if err != nil {
		store.notFoundOrFatal(err)
		return nil
	}
	return
}
