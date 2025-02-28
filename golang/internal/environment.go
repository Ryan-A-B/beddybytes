package internal

import (
	"log"
	"net/url"
	"os"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

func EnvStringOrDefault(key string, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func EnvStringOrFatal(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s must be set", key)
	}
	return value
}

func EnvURLOrFatal(key string) *url.URL {
	value := EnvStringOrFatal(key)
	target, err := url.Parse(value)
	fatal.OnError(err)
	return target
}
