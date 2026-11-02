import os
import uvicorn
from .config import port

if __name__ == '__main__':
    # One process owns the in-memory task locks and expiring downloads.
    uvicorn.run('backend.app:app', host=os.getenv('HOST', '127.0.0.1'), port=port(), workers=1)
