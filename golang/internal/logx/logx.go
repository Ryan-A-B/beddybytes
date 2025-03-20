package logx

import (
	"fmt"
	"log"
	"os"
)

var std = log.New(os.Stderr, "", log.LstdFlags)

var Traceln = make("Trace: ")
var Infoln = make("Info: ")
var Warnln = make("Warn: ")
var Errorln = make("Error: ")

func make(prefix string) func(v ...any) {
	return func(v ...any) {
		std.Output(2, prefix+fmt.Sprintln(v...))
	}
}

func SetFlags(flag int) {
	std.SetFlags(flag)
}
