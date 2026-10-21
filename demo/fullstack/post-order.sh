#!/bin/sh
# demo helper — publish an order message through the RabbitMQ queue
cd "$(dirname "$0")"
printf '%s\n' "\$ curl -s -X POST localhost:30000/orders -H 'content-type: application/json' --data '{\"product\":\"anvil\",\"qty\":2}'"
curl -s -X POST localhost:30000/orders -H 'content-type: application/json' --data '{"product":"anvil","qty":2}'
printf '\n'
