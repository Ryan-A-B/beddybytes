all: babymonitor.local.key babymonitor.local.crt

babymonitor.local.key:
	openssl genrsa -out $@ 2048

babymonitor.local.csr: babymonitor.local.key
	openssl req -new -sha256 -key $< -out $@ -subj "/C=AU/ST=Queensland/L=Brisbane/CN=*.babymonitor.com"

babymonitor.local.crt: babymonitor.local.key babymonitor.local.csr
	openssl x509 -req -days 365 -in babymonitor.local.csr -signkey $< -out $@

clean:
	rm -f *.key *.csr *.crt

.PHONY: all clean