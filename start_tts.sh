#!/bin/bash
# ICMYP Biology Study Hub — TTS server launcher
# Usage: ./start_tts.sh  (run this once before opening unit HTML pages)
#
# This starts a local Edge-TTS proxy (Microsoft neural voices) on port 8766.
# - Free, no API key, no rate limit
# - Voices: Jenny / Aria (US) · Emma (UK) · Ana (younger) · Guy (male)
# - Caches all generated audio to ~/.cache/icmyp_tts/ for instant replay
# - Once running, leave it in the background. HTML pages auto-detect it.

set -e

PORT=8766
PYTHON="python3"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/tts_server.py"

# Already running?
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✅ TTS server already running on port $PORT"
  curl -s http://127.0.0.1:$PORT/health && echo ""
  exit 0
fi

echo "🔊 Starting Edge-TTS proxy server..."
nohup "$PYTHON" "$SCRIPT" > /tmp/icmyp_tts.log 2>&1 &
PID=$!
echo "   PID: $PID"

# Wait for it to bind
for i in {1..15}; do
  if curl -s http://127.0.0.1:$PORT/health >/dev/null 2>&1; then
    echo "✅ TTS server ready at http://127.0.0.1:$PORT"
    echo ""
    echo "   Test voices:"
    echo "     curl 'http://127.0.0.1:$PORT/tts?text=hello&voice=jenny'  --output test.mp3"
    echo ""
    echo "   Voices: jenny (US warm) · aria (US crisp) · emma (UK) · ana (young) · guy (male)"
    echo "   To stop: kill $PID  (or: lsof -ti :$PORT | xargs kill)"
    exit 0
  fi
  sleep 0.3
done

echo "❌ Server failed to start within 5s. Log:"
cat /tmp/icmyp_tts.log
exit 1
