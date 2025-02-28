FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum .
RUN go mod download
COPY golang ./golang
RUN go build -o backend ./golang/cmd/backend

FROM alpine:latest
WORKDIR /opt
COPY --from=builder /app/backend backend
CMD [ "./backend" ]