package main

import (
	"crypto/tls"
	"log"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

func main() {
	var err error
	options := mqtt.NewClientOptions()
	options.AddBroker("wss://mosquitto.beddybytes.local:443")
	options.SetTLSConfig(&tls.Config{
		InsecureSkipVerify: true,
	})
	client := mqtt.NewClient(options)
	err = mqttx.Wait(client.Connect())
	if err != nil {
		panic(err)
	}
	const topic = "accounts/+/connections/+/status"
	err = mqttx.Wait(client.Subscribe(topic, 1, handleMessage))
	if err != nil {
		panic(err)
	}
	log.Println("Subscribed to topic:", topic)
	<-time.After(5 * time.Minute)
}

func handleMessage(client mqtt.Client, message mqtt.Message) {
	defer message.Ack()
	log.Printf("%s: %s\n", message.Topic(), string(message.Payload()))
}
