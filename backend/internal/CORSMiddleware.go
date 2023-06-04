package internal

import "net/http"

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("Access-Control-Allow-Origin", "https://"+Domain+":3000")
		responseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		responseWriter.Header().Set("Access-Control-Allow-Credentials", "true")
		if request.Method == http.MethodOptions {
			return
		}
		next.ServeHTTP(responseWriter, request)
	})
}
