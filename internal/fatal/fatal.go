package fatal

import (
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
		log.Fatalf("%s\n%s", err, buffer)
	}
}
