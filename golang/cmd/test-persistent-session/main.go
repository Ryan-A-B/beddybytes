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
	clients := [2]mqtt.Client{createClientOne(), createClientTwo()}
	for _, client := range clients {
		err = mqttx.Wait(client.Connect())
		if err != nil {
			log.Fatal(err)
			return
		}
	}
	const topic = "test"
	const qualityOfService = 1
	const retain = false
	messageC := make(chan []byte)
	err = mqttx.Wait(clients[0].Subscribe(topic, qualityOfService, func(c mqtt.Client, message mqtt.Message) {
		messageC <- message.Payload()
		message.Ack()
	}))
	if err != nil {
		log.Fatal(err)
		return
	}
	err = mqttx.Wait(clients[1].Publish(topic, qualityOfService, retain, "First message"))
	if err != nil {
		log.Fatal(err)
		return
	}
	select {
	case message := <-messageC:
		log.Println("Recieved message:", string(message))
	case <-time.After(100 * time.Millisecond):
		log.Fatal("Timed out waiting for message")
	}
	clients[0].Disconnect(250)
	err = mqttx.Wait(clients[1].Publish(topic, qualityOfService, retain, "Second message"))
	if err != nil {
		log.Fatal(err)
		return
	}
	err = mqttx.Wait(clients[0].Connect())
	if err != nil {
		log.Fatal(err)
		return
	}
	select {
	case message := <-messageC:
		log.Println("Recieved message:", string(message))
	case <-time.After(100 * time.Millisecond):
		log.Fatal("Timed out waiting for message")
	}
}

func createClientOne() mqtt.Client {
	const clientID = "test-client-one"
	options := mqtt.NewClientOptions()
	options.AddBroker("wss://mosquitto.beddybytes.local:443")
	options.SetClientID(clientID)
	options.SetCleanSession(false)
	options.SetResumeSubs(true)
	options.SetTLSConfig(&tls.Config{
		InsecureSkipVerify: true,
	})
	return mqtt.NewClient(options)
}

func createClientTwo() mqtt.Client {
	const clientID = "test-client-two"
	options := mqtt.NewClientOptions()
	options.AddBroker("wss://mosquitto.beddybytes.local:443")
	options.SetClientID(clientID)
	options.SetTLSConfig(&tls.Config{
		InsecureSkipVerify: true,
	})
	return mqtt.NewClient(options)
}
