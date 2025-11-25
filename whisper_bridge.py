#!/usr/bin/env python3
"""
Whisper Bridge Script for OpenWhispr
Handles local speech-to-text processing using faster-whisper (CTranslate2)
"""

import sys
import json
import os
import argparse
import time
import threading
from faster_whisper import WhisperModel

# Global model cache to avoid reloading
_model_cache = {}

# Model name mappings for faster-whisper (must match actual HuggingFace repos)
# These mappings come from faster_whisper/utils.py _MODELS dict
MODEL_REPO_MAPPINGS = {
    # Multilingual models
    "tiny": "Systran/faster-whisper-tiny",
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large": "Systran/faster-whisper-large-v3",
    "turbo": "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
    # English-only models (slightly faster/better for English)
    "tiny.en": "Systran/faster-whisper-tiny.en",
    "base.en": "Systran/faster-whisper-base.en",
    "small.en": "Systran/faster-whisper-small.en",
    "medium.en": "Systran/faster-whisper-medium.en",
}

def get_model_repo(model_name):
    """Get the HuggingFace repo name for a model"""
    return MODEL_REPO_MAPPINGS.get(model_name, f"Systran/faster-whisper-{model_name}")

def load_model(model_name="base"):
    """Load Faster Whisper model with caching"""
    global _model_cache
    
    # Return cached model if available
    if model_name in _model_cache:
        return _model_cache[model_name]
    
    try:
        # On Mac (Apple Silicon or Intel), faster-whisper runs on CPU
        # compute_type="int8" is efficient and fast on CPU
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        
        if len(_model_cache) >= 2:
            oldest_key = next(iter(_model_cache))
            del _model_cache[oldest_key]
        
        _model_cache[model_name] = model
        return model
    except Exception as e:
        return None

def download_model(model_name="base"):
    """Download Faster Whisper model with progress tracking"""
    from huggingface_hub import snapshot_download, hf_hub_download
    from huggingface_hub.utils import HfHubHTTPError, RepositoryNotFoundError
    from pathlib import Path
    import sys

    model_repo = get_model_repo(model_name)

    try:
        print(f"PROGRESS:{json.dumps({'type': 'progress', 'model': model_name, 'percentage': 0, 'stage': 'Starting download...'})}", file=sys.stderr)
        sys.stderr.flush()

        # Download the model using snapshot_download
        # This will use the cached version if already downloaded
        print(f"PROGRESS:{json.dumps({'type': 'progress', 'model': model_name, 'percentage': 10, 'stage': 'Downloading model files...'})}", file=sys.stderr)
        sys.stderr.flush()

        local_path = snapshot_download(
            repo_id=model_repo,
            local_dir=None,  # Use default cache
            local_dir_use_symlinks=True
        )

        print(f"PROGRESS:{json.dumps({'type': 'progress', 'model': model_name, 'percentage': 80, 'stage': 'Verifying download...'})}", file=sys.stderr)
        sys.stderr.flush()

        # Verify the download by loading the model
        model = WhisperModel(model_name, device="cpu", compute_type="int8")

        # Cache it since we loaded it
        global _model_cache
        _model_cache[model_name] = model

        print(f"PROGRESS:{json.dumps({'type': 'complete', 'model': model_name, 'percentage': 100})}", file=sys.stderr)
        sys.stderr.flush()

        return {
            "model": model_name,
            "downloaded": True,
            "success": True
        }
    except RepositoryNotFoundError:
        return {
            "model": model_name,
            "downloaded": False,
            "error": f"Model repository not found: {model_repo}",
            "success": False
        }
    except Exception as e:
        return {
            "model": model_name,
            "downloaded": False,
            "error": str(e),
            "success": False
        }

def check_model_status(model_name="base"):
    """Check if a model is already downloaded by trying to locate it"""
    from pathlib import Path
    from huggingface_hub import try_to_load_from_cache
    from huggingface_hub.constants import HUGGINGFACE_HUB_CACHE

    try:
        model_repo = get_model_repo(model_name)

        # Use HuggingFace's own cache lookup - most reliable
        model_found = False
        try:
            # Try to find model.bin in the cache
            cached_path = try_to_load_from_cache(model_repo, "model.bin")
            if cached_path is not None:
                model_found = True
        except:
            pass

        # Fallback: check if the model directory exists with refs/main
        if not model_found:
            model_dir_name = f"models--{model_repo.replace('/', '--')}"
            cache_dir = Path(HUGGINGFACE_HUB_CACHE)
            model_cache_path = cache_dir / model_dir_name

            if model_cache_path.exists():
                refs_main = model_cache_path / "refs" / "main"
                if refs_main.exists():
                    model_found = True

        # Calculate size from blobs directory
        total_size_bytes = 0
        if model_found:
            model_dir_name = f"models--{model_repo.replace('/', '--')}"
            cache_dir = Path(HUGGINGFACE_HUB_CACHE)
            blobs_dir = cache_dir / model_dir_name / "blobs"
            if blobs_dir.exists():
                for blob in blobs_dir.iterdir():
                    if blob.is_file():
                        try:
                            total_size_bytes += blob.stat().st_size
                        except:
                            pass

        size_mb = round(total_size_bytes / (1024 * 1024)) if total_size_bytes > 0 else None

        return {
            "model": model_name,
            "downloaded": model_found,
            "size_mb": size_mb,
            "success": True
        }
    except Exception as e:
        return {
            "model": model_name,
            "downloaded": False,
            "error": str(e),
            "success": False
        }

def list_models():
    """List available models with their sizes"""
    # Standard multilingual models
    standard_models = ["tiny", "base", "small", "medium", "large", "turbo"]
    # English-only models (slightly faster/better for English)
    english_models = ["tiny.en", "base.en", "small.en", "medium.en"]

    model_info = []

    for model in standard_models:
        status = check_model_status(model)
        model_info.append({
            "model": model,
            "downloaded": status.get("downloaded", False),
            "size_mb": status.get("size_mb"),
            "english_only": False,
            "success": True
        })

    for model in english_models:
        status = check_model_status(model)
        model_info.append({
            "model": model,
            "downloaded": status.get("downloaded", False),
            "size_mb": status.get("size_mb"),
            "english_only": True,
            "success": True
        })

    return {
        "models": model_info,
        "success": True
    }

def delete_model(model_name="base"):
    """Delete a downloaded model from HuggingFace cache"""
    import shutil
    from pathlib import Path

    try:
        model_repo = get_model_repo(model_name)
        model_dir_name = f"models--{model_repo.replace('/', '--')}"

        # HuggingFace cache location
        cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
        model_cache_path = cache_dir / model_dir_name

        freed_bytes = 0

        if model_cache_path.exists():
            # Calculate size before deletion
            for file in model_cache_path.glob("**/*"):
                if file.is_file():
                    try:
                        freed_bytes += file.stat().st_size
                    except:
                        pass

            # Delete the model directory
            shutil.rmtree(model_cache_path)

            # Clear from model cache if loaded
            global _model_cache
            if model_name in _model_cache:
                del _model_cache[model_name]

        freed_mb = round(freed_bytes / (1024 * 1024))

        return {
            "model": model_name,
            "deleted": True,
            "freed_mb": freed_mb,
            "success": True
        }
    except Exception as e:
        return {
            "model": model_name,
            "deleted": False,
            "error": str(e),
            "success": False
        }

def transcribe_audio(audio_path, model_name="base", language=None, initial_prompt=None):
    """Transcribe audio file using Faster Whisper"""

    if not os.path.exists(audio_path):
        return {"error": f"Audio file not found: {audio_path}", "success": False}

    try:
        model = load_model(model_name)
        if model is None:
            return {"error": "Failed to load Whisper model", "success": False}

        # Adaptive beam size based on model size
        # Smaller models work better with smaller beam sizes
        # Larger models benefit from larger beam sizes for accuracy
        if model_name in ["tiny", "base"]:
            beam_size = 1  # Fast, good for smaller models
        elif model_name in ["small"]:
            beam_size = 3  # Balanced
        else:  # medium, large, turbo
            beam_size = 5  # Maximum accuracy for larger models

        # Transcribe with optional initial_prompt
        segments, info = model.transcribe(
            audio_path,
            beam_size=beam_size,
            language=language,
            initial_prompt=initial_prompt
        )

        # Gather segments with proper spacing
        text_segments = []
        for segment in segments:
            text_segments.append(segment.text)

        # Join with spaces to separate words properly
        full_text = " ".join(text_segments).strip()

        return {
            "text": full_text,
            "language": info.language,
            "success": True
        }

    except Exception as e:
        return {
            "error": str(e),
            "success": False
        }

def check_ffmpeg():
    """Check if FFmpeg is available (less critical for faster-whisper but good to have)"""
    # faster-whisper uses PyAV which bundles ffmpeg, so this is always effectively true
    return {
        "available": True,
        "version": "Bundled with PyAV",
        "success": True
    }

def main():
    parser = argparse.ArgumentParser(description="Whisper Bridge for OpenWhispr (Faster Whisper)")
    parser.add_argument("--mode", default="transcribe",
                       choices=["transcribe", "download", "check", "list", "delete", "check-ffmpeg"],
                       help="Operation mode")
    parser.add_argument("audio_file", nargs="?", help="Path to audio file")
    parser.add_argument("--model", default="base", help="Whisper model to use")
    parser.add_argument("--language", help="Language code")
    parser.add_argument("--initial-prompt", help="Initial prompt to guide transcription")
    parser.add_argument("--output-format", default="json", choices=["json", "text"])
    
    args = parser.parse_args()
    
    if args.mode == "download":
        print(json.dumps(download_model(args.model)))
    elif args.mode == "check":
        print(json.dumps(check_model_status(args.model)))
    elif args.mode == "list":
        print(json.dumps(list_models()))
    elif args.mode == "delete":
        print(json.dumps(delete_model(args.model)))
    elif args.mode == "check-ffmpeg":
        print(json.dumps(check_ffmpeg()))
    elif args.mode == "transcribe":
        if not args.audio_file:
            print(json.dumps({"error": "Audio file required", "success": False}))
            sys.exit(1)
        
        result = transcribe_audio(args.audio_file, args.model, args.language, args.initial_prompt)
        
        if args.output_format == "json":
            print(json.dumps(result))
        else:
            if result.get("success"):
                print(result.get("text", ""))
            else:
                print(f"Error: {result.get('error')}", file=sys.stderr)
                sys.exit(1)

if __name__ == "__main__":
    main()