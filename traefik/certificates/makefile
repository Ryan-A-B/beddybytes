all: beddybytes.local.key beddybytes.local.crt

beddybytes.local.key:
	openssl genrsa -out $@ 2048

beddybytes.local.csr: beddybytes.local.key
	openssl req -new -sha256 -key $< -out $@ -subj "/C=AU/ST=Queensland/L=Brisbane/CN=*.beddybytes.local"

beddybytes.local.crt: beddybytes.local.key beddybytes.local.csr
	openssl x509 -req -days 365 -in beddybytes.local.csr -signkey $< -out $@

clean:
	rm -f *.key *.csr *.crt

.PHONY: all clean