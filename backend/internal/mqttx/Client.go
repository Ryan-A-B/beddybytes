package mqttx

import mqtt "github.com/eclipse/paho.mqtt.golang"

func Wait(token mqtt.Token) error {
	<-token.Done()
	return token.Error()
}
