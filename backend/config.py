import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')


def ai_provider_status():
    return [dict(id=provider, configured=bool(os.getenv(key)),
                 ready=bool(os.getenv(key)) and os.getenv(confirmation)=='true',
                 model=os.getenv(model_env,model))
            for provider,key,confirmation,model_env,model in (
                ('openai','OPENAI_API_KEY','OPENAI_CREDITS_CONFIRMED','OPENAI_MODEL','gpt-5.6-terra'),
                ('nvidia','NVIDIA_API_KEY','AI_FREE_TIER_CONFIRMED','NVIDIA_MODEL','nvidia/nemotron-3.5-super-vl-120b-a12b'))]


def ai_ready():
    return any(provider['ready'] for provider in ai_provider_status())


def port():
    return int(os.getenv('PORT', '4311'))
