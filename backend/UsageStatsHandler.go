package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Ryan-A-B/beddybytes/backend/internal/xhttp"
)

func (handlers *Handlers) GetTotalDuration(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			xhttp.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	totalDuration := handlers.UsageStats.GetTotalDuration(ctx)
	responseWriter.Header().Set("Content-Type", "application/json")
	const maxAge = 5 * 60
	const staleWhileRevalidate = 4 * 60 * 60
	const staleIfError = 7 * 24 * 60 * 60
	cacheControl := fmt.Sprintf("max-age=%d, stale-while-revalidate=%d, stale-if-error=%d", maxAge, staleWhileRevalidate, staleIfError)
	responseWriter.Header().Set("Cache-Control", cacheControl)
	json.NewEncoder(responseWriter).Encode(totalDuration)
}
