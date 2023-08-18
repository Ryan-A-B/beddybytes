package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

func main() {
	target := url.URL{
		Scheme: os.Getenv("SQUARE_SCHEME"),
		Host:   os.Getenv("SQUARE_HOST"),
		Path:   "/v2/catalog/list",
	}
	request, err := http.NewRequest(http.MethodGet, target.String(), nil)
	fatal.OnError(err)
	request.Header.Set("Authorization", "Bearer "+os.Getenv("SQUARE_ACCESS_TOKEN"))
	request.Header.Add("Square-Version", "2023-07-20")
	request.Header.Add("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	fatal.OnError(err)
	defer response.Body.Close()
	fatal.Unless(response.StatusCode == http.StatusOK, "response.StatusCode != http.StatusOK")
	payload := make(map[string]interface{})
	err = json.NewDecoder(response.Body).Decode(&payload)
	fatal.OnError(err)
	PrintJSON(payload)
}

func PrintJSON(v interface{}) {
	json, err := json.MarshalIndent(v, "", "  ")
	fatal.OnError(err)
	fmt.Println(string(json))
}
