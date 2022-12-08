#!/bin/bash

tsc -p tsconfig.json && node target/main.js "$@"
