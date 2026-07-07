#!/bin/bash
# All-in-one: launch chrome, run tests, capture, kill chrome.
set +e

PORT=9222
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
sleep 0.5

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --no-first-run \
  --disable-extensions \
  --remote-debugging-port=$PORT \
  --user-data-dir=/tmp/chrome-debug-profile \
  --window-size=1400,2400 \
  about:blank > /tmp/chrome.log 2>&1 &
CPID=$!

# Wait for CDP
for i in $(seq 1 40); do
  curl -s http://127.0.0.1:$PORT/json/version >/dev/null 2>&1 && break
  sleep 0.25
done

# Run the test
NODE=/Users/fy/.workbuddy/binaries/node/versions/22.22.2/bin/node
NODE_PATH=/Users/fy/.workbuddy/binaries/node/workspace/node_modules $NODE /tmp/debug_unit2.cjs 2>&1
TEST_EXIT=$?

# Cleanup
kill -9 $CPID 2>/dev/null
wait $CPID 2>/dev/null
exit $TEST_EXIT
