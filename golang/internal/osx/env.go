package osx

import (
	"log"
	"os"
)

func GetEnvStringOrFatal(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s must be set", key)
	}
	return value
}
