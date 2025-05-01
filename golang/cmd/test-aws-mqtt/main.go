package main

import (
	"crypto/tls"
	"crypto/x509"
	"log"
	"os"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

const rootCAFile = "AmazonRootCA1.pem"
const certFile = "2725a1918604157515d41bd35b5c771b610568dd05fdb455d020f44c7bd3d38a-certificate.pem.crt"
const keyFile = "local.private_key.pem"

func main() {
	rootCA, err := os.ReadFile(rootCAFile)
	if err != nil {
		log.Fatal("Error loading root CA:", err)
		return
	}
	rootCAs := x509.NewCertPool()
	if !rootCAs.AppendCertsFromPEM(rootCA) {
		log.Fatal("Error appending root CA certificate")
		return
	}
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		log.Fatal("Error loading certificate:", err)
		return
	}
	tlsConfig := tls.Config{
		RootCAs:            rootCAs,
		Certificates:       []tls.Certificate{cert},
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: false,
	}
	options := mqtt.NewClientOptions()
	options.AddBroker("ssl://a2g6cxhf9lu5os-ats.iot.us-east-1.amazonaws.com:8883")
	options.SetTLSConfig(&tlsConfig)
	options.SetClientID("test-client")
	options.SetKeepAlive(60 * time.Second)
	options.SetPingTimeout(10 * time.Second)
	options.OnConnect = func(client mqtt.Client) {
		log.Println("Connected to broker")
	}
	options.OnConnectionLost = func(client mqtt.Client, err error) {
		log.Println("Connection lost:", err)
	}
	client := mqtt.NewClient(options)
	err = mqttx.Wait(client.Connect())
	if err != nil {
		log.Fatal("Error connecting to broker:", err)
		return
	}
	defer client.Disconnect(250)
	topic := "test/topic"
	payload := "Hello, MQTT!"
	doneC := make(chan struct{})
	err = mqttx.Wait(client.Subscribe(topic, 1, func(client mqtt.Client, msg mqtt.Message) {
		log.Printf("Received message: %s from topic: %s\n", msg.Payload(), msg.Topic())
		close(doneC)
	}))
	if err != nil {
		log.Fatal("Error subscribing to topic:", err)
		return
	}
	err = mqttx.Wait(client.Publish(topic, 1, false, payload))
	if err != nil {
		log.Fatal("Error publishing message:", err)
		return
	}
	<-doneC
}
