package fatal

import (
	"encoding/json"
	"log"
	"runtime"
)

func Unless(ok bool, message string) {
	if !ok {
		buffer := make([]byte, 1<<16)
		runtime.Stack(buffer, false)
		log.Fatalf("%s\n%s", message, buffer)
	}
}

func OnError(err error) {
	if err != nil {
		buffer := make([]byte, 1<<16)
		runtime.Stack(buffer, false)
		log.Println("FATAL", err)
		log.Fatal(string(buffer))
	}
}

func UnlessMarshalJSON(v interface{}) (data []byte) {
	data, err := json.Marshal(v)
	OnError(err)
	return
}

func UnlessUnmarshalJSON(data []byte, v interface{}) {
	err := json.Unmarshal(data, v)
	OnError(err)
}
