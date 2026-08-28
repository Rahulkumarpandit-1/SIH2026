import os
import sys
import subprocess
import signal
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def main():
    print("=" * 70)
    print(" SIH26162 — UNIFIED DEV SERVER (FRONTEND + BACKEND)")
    print("=" * 70)
    print(f"[*] Starting FastAPI Backend at http://127.0.0.1:8000...")
    print(f"[*] Starting Vite Frontend at   http://localhost:5173...")
    print("=" * 70)

    # 1. Start Backend (FastAPI via uvicorn)
    py_exec = "py" if sys.platform == "win32" else sys.executable
    backend_cmd = [
        py_exec, "-m", "uvicorn", "app.main:app",
        "--reload",
        "--host", "127.0.0.1",
        "--port", "8000"
    ]
    
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(BACKEND_DIR),
        env=os.environ.copy()
    )

    # Give backend a moment to bind port
    time.sleep(1.5)

    # 2. Start Frontend (Vite)
    frontend_cmd = ["npm", "run", "dev"]
    if sys.platform == "win32":
        frontend_cmd = ["cmd", "/c", "npm", "run", "dev"]

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        env=os.environ.copy()
    )

    print("\n[+] Both Backend and Frontend are running!")
    print("[+] Press Ctrl+C at any time to cleanly stop both servers.\n")

    def signal_handler(sig, frame):
        print("\n[*] Shutting down dev servers...")
        try:
            frontend_proc.terminate()
            backend_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        while True:
            time.sleep(1)
            # If any process exited unexpectedly, exit
            if backend_proc.poll() is not None:
                print(f"[!] Backend process exited with code {backend_proc.returncode}")
                frontend_proc.terminate()
                break
            if frontend_proc.poll() is not None:
                print(f"[!] Frontend process exited with code {frontend_proc.returncode}")
                backend_proc.terminate()
                break
    except KeyboardInterrupt:
        signal_handler(None, None)


if __name__ == "__main__":
    main()
