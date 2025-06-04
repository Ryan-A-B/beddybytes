package logx

import (
	"fmt"
	"log"
	"os"
)

var std = log.New(os.Stderr, "", log.LstdFlags)

var Traceln = makePrintln("Trace: ")
var Infoln = makePrintln("Info: ")
var Warnln = makePrintln("Warn: ")
var Errorln = makePrintln("Error: ")

func makePrintln(prefix string) func(v ...any) {
	return func(v ...any) {
		std.Output(2, prefix+fmt.Sprintln(v...))
	}
}

var Tracef = makePrintf("Trace: ")
var Infof = makePrintf("Info: ")
var Warnf = makePrintf("Warn: ")
var Errorf = makePrintf("Error: ")

func makePrintf(prefix string) func(format string, v ...any) {
	return func(format string, v ...any) {
		std.Output(2, fmt.Sprintf(prefix+format, v...))
	}
}

func SetFlags(flag int) {
	std.SetFlags(flag)
}
