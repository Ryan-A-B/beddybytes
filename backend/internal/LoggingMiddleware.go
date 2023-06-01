package internal

import (
	"log"
	"net/http"
	"time"
)

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
		loggingResponseWriter := &LoggingResponseWriter{
			ResponseWriter: responseWriter,
			statusCode:     http.StatusOK,
		}
		next.ServeHTTP(loggingResponseWriter, request)
		dt := time.Since(t0)
		log.Println(request.Method, request.URL.Path, loggingResponseWriter.statusCode, dt)
	})
}
