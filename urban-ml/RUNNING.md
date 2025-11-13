Running the Urban ML backend locally

Quick steps (PowerShell)

1) Open PowerShell and change to the project folder:

```powershell
cd C:\Users\user\Downloads\urban-ml\urban-ml
```

2) (Optional) Activate venv if you prefer interactive environment:

```powershell
# If you created the venv at .venv
. .\.venv\Scripts\Activate.ps1
```

3) Start the server detached (uses .venv/python if present):

```powershell
# If execution policy prevents scripts, run once:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
# Then start server
.\start-server.ps1
```

4) Verify the service is up:

```powershell
.\test-health.ps1
```

Notes
- If you prefer to run in the foreground for debugging, run:

```powershell
python -m uvicorn ml_api_fastapi:app --app-dir "C:\Users\user\Downloads\urban-ml\urban-ml" --host 127.0.0.1 --port 8000
```

- Logs will be printed to the console when running in the foreground.
- Redis is optional; the app will run without Redis, but caching is disabled if Redis isn't reachable.
- Model .pkl files are optional — the app uses fallback heuristics if models are missing.
