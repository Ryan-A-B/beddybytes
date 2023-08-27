package eventlog

import (
	"bufio"
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"

	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

const MetadataFileName = "metadata.json"
const EventsFileName = "events.jsonl"

type FileEventLog struct {
	folderPath string
	file       *os.File
	cursor     int
}

type NewFileEventLogInput struct {
	FolderPath string
}

func NewFileEventLog(input *NewFileEventLogInput) *FileEventLog {
	metadataFilePath := filepath.Join(input.FolderPath, MetadataFileName)
	metadata := readFileEventLogMetadata(metadataFilePath)
	eventsFilePath := filepath.Join(input.FolderPath, EventsFileName)
	file, err := os.OpenFile(eventsFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	fatal.OnError(err)
	return &FileEventLog{
		folderPath: input.FolderPath,
		file:       file,
		cursor:     metadata.Cursor,
	}
}

func (log *FileEventLog) Append(ctx context.Context, input *AppendInput) (event *Event, err error) {
	log.cursor++
	event = &Event{
		ID:            uuid.NewV4().String(),
		Type:          input.Type,
		AccountID:     input.AccountID,
		LogicalClock:  log.cursor,
		UnixTimestamp: time.Now().Unix(),
		Data:          input.Data,
	}
	err = json.NewEncoder(log.file).Encode(event)
	fatal.OnError(err)
	err = log.file.Sync()
	fatal.OnError(err)
	metadataFilePath := filepath.Join(log.folderPath, MetadataFileName)
	writeFileEventLogMetadata(metadataFilePath, &FileEventLogMetadata{
		Cursor: log.cursor,
	})
	return
}

func (log *FileEventLog) GetEventIterator(ctx context.Context, input *GetEventIteratorInput) EventIterator {
	filePath := filepath.Join(log.folderPath, EventsFileName)
	file, err := os.Open(filePath)
	fatal.OnError(err)
	scanner := bufio.NewScanner(file)
	for i := 0; i < input.FromCursor; i++ {
		ok := scanner.Scan()
		if !ok {
			return new(NullEventIterator)
		}
	}
	return &FileEventIterator{
		file:    file,
		scanner: scanner,
	}
}

type FileEventIterator struct {
	file    *os.File
	scanner *bufio.Scanner

	event *Event
}

func (iterator *FileEventIterator) Next() bool {
	ok := iterator.scanner.Scan()
	if !ok {
		err := iterator.file.Close()
		fatal.OnError(err)
		return false
	}
	data := iterator.scanner.Bytes()
	var event Event
	err := json.Unmarshal(data, &event)
	fatal.OnError(err)
	iterator.event = &event
	return true
}

func (iterator *FileEventIterator) Event() *Event {
	return iterator.event
}

func (iterator *FileEventIterator) Err() error {
	return nil
}

type FileEventLogMetadata struct {
	Cursor int `json:"cursor"`
}

func readFileEventLogMetadata(filePath string) (metadata *FileEventLogMetadata) {
	metadata = new(FileEventLogMetadata)
	file, err := os.Open(filePath)
	switch {
	case err == nil:
		defer file.Close()
		metadata = new(FileEventLogMetadata)
		err = json.NewDecoder(file).Decode(metadata)
		fatal.OnError(err)
	case os.IsNotExist(err):
		log.Println("Notice: no metadata file found, starting from scratch")
	default:
		fatal.OnError(err)
	}
	return
}

func writeFileEventLogMetadata(filePath string, metadata *FileEventLogMetadata) (err error) {
	file, err := os.Create(filePath)
	fatal.OnError(err)
	defer file.Close()
	err = json.NewEncoder(file).Encode(metadata)
	fatal.OnError(err)
	return
}
