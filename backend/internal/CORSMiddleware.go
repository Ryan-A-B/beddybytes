package internal

import (
	"net/http"
)

func CORSMiddleware(origin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
			responseWriter.Header().Set("Access-Control-Allow-Origin", origin)
			responseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
			responseWriter.Header().Set("Access-Control-Allow-Credentials", "true")
			if request.Method == http.MethodOptions {
				return
			}
			next.ServeHTTP(responseWriter, request)
		})
	}
}
