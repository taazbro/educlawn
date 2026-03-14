from __future__ import annotations

import os

import uvicorn
from app.main import app as studio_app


if __name__ == "__main__":
    host = os.getenv("CIVIC_STUDIO_HOST", "127.0.0.1")
    port = int(os.getenv("CIVIC_STUDIO_PORT", "8123"))
    uvicorn.run(studio_app, host=host, port=port, reload=False)
