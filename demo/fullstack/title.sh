#!/bin/sh
# demo/fullstack/title.sh — console style title cards for the kustron demo
# usage: ./title.sh <n>
cd "$(dirname "$0")"
n="${1:-0}"
banner() {
  printf '\n'
  printf '  --------------------------------------------------------------\n'
  printf '   %s\n' "$1"
  printf '  --------------------------------------------------------------\n'
  printf '\n'
}
case "$n" in
  0) banner "Kustron - from zero to a fullstack environment, in 3 minutes" ;;
  1) banner "Part 1  -  A CRUD service on Node.js + Express, backed by kivo (KV store)" ;;
  2) banner "Part 2  -  Add a route, watch kustron catch it and rebuild live" ;;
  3) banner "Part 3  -  Add a Helm chart: RabbitMQ orders stream into kivo" ;;
  4) banner "Part 4  -  One line: deploy straight from a public GitHub repo" ;;
  5) banner "Done. env destroy cleans up - your kubeconfig is never touched" ;;
esac
