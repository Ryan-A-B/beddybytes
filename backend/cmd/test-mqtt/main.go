package main

import (
	"crypto/tls"
	"fmt"
	"log"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

func main() {
	options := mqtt.NewClientOptions()
	options.AddBroker("wss://mosquitto.beddybytes.local:443")
	options.SetTLSConfig(&tls.Config{
		InsecureSkipVerify: true,
	})
	client := mqtt.NewClient(options)
	connectionToken := client.Connect()
	log.Println("Connecting to broker...")
	<-connectionToken.Done()
	err := connectionToken.Error()
	if err != nil {
		log.Fatal(err)
		return
	}

	const topic = "test"
	const qualityOfService = 1
	const retain = false

	subscriptionToken := client.Subscribe(topic, qualityOfService, handleMessage)
	log.Println("Subscribing to topic...")
	<-subscriptionToken.Done()
	err = subscriptionToken.Error()
	if err != nil {
		log.Fatal(err)
		return
	}

	publishToken := client.Publish(topic, qualityOfService, retain, "Hello, World!")
	log.Println("Publishing message...")
	<-publishToken.Done()
	err = publishToken.Error()
	if err != nil {
		log.Fatal(err)
		return
	}

	client.Disconnect(250)
}

func handleMessage(client mqtt.Client, message mqtt.Message) {
	defer message.Ack()
	fmt.Println("Recieved message:", string(message.Payload()))
}
