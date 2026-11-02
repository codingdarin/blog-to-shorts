import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')


def ai_ready():
    return bool(os.getenv('NVIDIA_API_KEY') or os.getenv('GEMINI_API_KEY')) and os.getenv('AI_FREE_TIER_CONFIRMED') == 'true'


def port():
    return int(os.getenv('PORT', '4311'))
