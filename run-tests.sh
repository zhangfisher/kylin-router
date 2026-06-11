#!/bin/bash
cd "E:\Work\Code\kylin-router"
bun test src/__tests__/features.render.test.ts 2>&1 | tee /tmp/full-test-output.txt | tail -5
