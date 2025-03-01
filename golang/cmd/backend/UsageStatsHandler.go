package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
)

func (handlers *Handlers) GetTotalHours(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			httpx.Error(responseWriter, err)
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
	json.NewEncoder(responseWriter).Encode(totalDuration / time.Hour)
}
