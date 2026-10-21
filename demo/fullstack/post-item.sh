#!/bin/sh
# demo helper — add one item to the store through the CRUD API
cd "$(dirname "$0")"
printf '%s\n' "\$ curl -s -X POST localhost:30000/items -H 'content-type: application/json' --data '{\"id\":\"sku-1001\",\"product\":\"anvil\",\"price\":\"42.00\"}'"
curl -s -X POST localhost:30000/items -H 'content-type: application/json' --data '{"id":"sku-1001","product":"anvil","price":"42.00"}'
printf '\n'
