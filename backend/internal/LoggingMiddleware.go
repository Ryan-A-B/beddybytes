package internal

import (
	"log"
	"net/http"
	"time"
)

// TODO using this causes: websocket: response does not implement http.Hijacker
type LoggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (loggingResponseWriter *LoggingResponseWriter) WriteHeader(statusCode int) {
	loggingResponseWriter.statusCode = statusCode
	loggingResponseWriter.ResponseWriter.WriteHeader(statusCode)
}

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		t0 := time.Now()
		next.ServeHTTP(responseWriter, request)
		dt := time.Since(t0)
		log.Println(request.Method, request.URL.Path, dt)
	})
}
