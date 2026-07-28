#!/bin/bash
cd "$(dirname "$0")"
PORT=4173 node serve.mjs &
SERVER_PID=$!
sleep 1
open "http://localhost:4173/index.html"
wait "$SERVER_PID"
