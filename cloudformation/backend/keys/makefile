name ?= local
key = $(name).private_key.pem
csr = $(name).csr

.PHONY: all clean

all: $(key) $(csr)

$(key):
	@echo "Generating private key $@..."
	openssl genpkey -algorithm RSA -out $@ -pkeyopt rsa_keygen_bits:2048
	@echo "Private key saved to $@"

$(csr): $(key)
	@echo "Generating CSR for $<..."
	openssl req -new -key $< -out $@ -subj "/CN=$(name)"
	@echo "CSR saved to $@"

clean:
	@echo "Cleaning up..."
	rm -f *.pem *.csr