all: beddybytes.local.key beddybytes.local.crt

beddybytes.local.key beddybytes.local.crt:
	mkcert -cert-file beddybytes.local.crt -key-file beddybytes.local.key \
		beddybytes.local \
		"*.beddybytes.local"

clean:
	rm -f *.key *.crt

.PHONY: all clean
