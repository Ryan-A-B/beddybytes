package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

type FileSystemStore struct {
	root string
}

type NewFileSystemStoreInput struct {
	Root string
}

func NewFileSystemStore(input *NewFileSystemStoreInput) (store *FileSystemStore) {
	store = &FileSystemStore{
		root: input.Root,
	}
	return
}

func (store *FileSystemStore) getFilePath(key string) string {
	hash := sha256.New()
	io.WriteString(hash, key)
	sum := hash.Sum(nil)
	return filepath.Join(store.root, hex.EncodeToString(sum))
}

func (store *FileSystemStore) Put(ctx context.Context, key string, data []byte) (err error) {
	path := store.getFilePath(key)
	file, err := os.Create(path)
	fatal.OnError(err)
	defer file.Close()
	_, err = file.Write(data)
	fatal.OnError(err)
	return
}

func (store *FileSystemStore) Get(ctx context.Context, key string) (data []byte, err error) {
	path := store.getFilePath(key)
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		err = ErrNotFound.WithCause(err)
		return
	}
	fatal.OnError(err)
	defer file.Close()
	data, err = ioutil.ReadAll(file)
	fatal.OnError(err)
	return
}

func (store *FileSystemStore) Delete(ctx context.Context, key string) (err error) {
	err = os.Remove(store.getFilePath(key))
	if os.IsNotExist(err) {
		return nil
	}
	fatal.OnError(err)
	return
}
