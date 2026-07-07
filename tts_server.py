#!/usr/bin/env python3
"""
Local TTS proxy server for ICMYP Biology Study Hub.
Uses Microsoft Edge-TTS (neural network voices, free, no API key).

Usage:
  python tts_server.py
  # Then HTML pages request: http://127.0.0.1:8766/tts?text=Hello&voice=Jenny
"""
import asyncio
import hashlib
import os
import sys
import urllib.parse
from aiohttp import web
import edge_tts

# ─── Config ───
HOST = "127.0.0.1"
PORT = 8766
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".cache", "icmyp_tts")
os.makedirs(CACHE_DIR, exist_ok=True)

# Voice map — short name → full Edge-TTS voice ID
# Picked the clearest, most natural neural female voices for biology vocab.
VOICE_MAP = {
    "jenny":  "en-US-JennyNeural",   # warm, natural, default
    "aria":   "en-US-AriaNeural",    # crisp, articulate (great for terms)
    "ana":    "en-US-AnaNeural",     # younger female, bilingual EN+ES
    "emma":   "en-GB-EmmaNeural",    # British female (IGCSE UK English)
    "sonya":  "en-US-EmmaNeural",    # alias
    "guy":    "en-US-GuyNeural",     # male
    "default":"en-US-JennyNeural",
}

async def handle_tts(request):
    """GET /tts?text=...&voice=jenny → audio/mpeg MP3."""
    text = request.query.get("text", "").strip()
    voice_key = (request.query.get("voice") or "jenny").lower()
    if not text:
        return web.Response(status=400, text="missing text")
    voice = VOICE_MAP.get(voice_key, VOICE_MAP["default"])

    # Rate / pitch (optional) — slightly slower for vocab clarity
    rate = request.query.get("rate", "-5%")   # 5% slower by default
    pitch = request.query.get("pitch", "+0Hz")

    # Cache by (text, voice, rate, pitch) hash → reuse MP3
    cache_key = hashlib.md5(f"{text}|{voice}|{rate}|{pitch}".encode()).hexdigest()
    cache_path = os.path.join(CACHE_DIR, cache_key + ".mp3")
    if os.path.exists(cache_path):
        # cache hit
        return web.FileResponse(cache_path, headers={
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        })

    # Generate via Edge-TTS
    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await comm.save(cache_path)
        return web.FileResponse(cache_path, headers={
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        })
    except Exception as e:
        return web.Response(status=502, text=f"TTS failed: {e}")

async def handle_voices(request):
    """GET /voices → list available voices."""
    return web.json_response(
        {k: v for k, v in VOICE_MAP.items() if k != "default"},
        headers={"Access-Control-Allow-Origin": "*"}
    )

async def handle_health(request):
    return web.Response(text="ok", headers={"Access-Control-Allow-Origin": "*"})

async def handle_options(request):
    # CORS preflight
    return web.Response(headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    })

app = web.Application()
app.router.add_get("/tts", handle_tts)
app.router.add_get("/voices", handle_voices)
app.router.add_get("/health", handle_health)
app.router.add_route("OPTIONS", "/{tail:.*}", handle_options)

if __name__ == "__main__":
    print(f"🔊 Edge-TTS proxy serving at http://{HOST}:{PORT}")
    print(f"   Cache dir: {CACHE_DIR}")
    print(f"   Test: curl 'http://{HOST}:{PORT}/tts?text=hello&voice=jenny' --output test.mp3")
    web.run_app(app, host=HOST, port=PORT, print=None)
