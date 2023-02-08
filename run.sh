#!/bin/bash

node_modules/.bin/tsc -p tsconfig.json && node target/main.js "$@"
