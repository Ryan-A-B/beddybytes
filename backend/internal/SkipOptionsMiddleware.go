package internal

import "net/http"

func SkipOptionsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodOptions {
			return
		}
		next.ServeHTTP(responseWriter, request)
	})
}
