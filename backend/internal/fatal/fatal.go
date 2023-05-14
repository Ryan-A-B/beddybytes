package fatal

import "log"

func Unless(ok bool, message string) {
	if !ok {
		log.Fatal(message)
	}
}

func OnError(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
