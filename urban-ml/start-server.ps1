# Start the Urban ML FastAPI server in a detached process
# Usage: Open PowerShell in this folder and run: .\start-server.ps1
# You can run it with an elevated policy for the session if needed:
# PowerShell: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; .\start-server.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $scriptDir

# Prefer local .venv python if it exists
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    $python = $venvPython
} else {
    # fallback to system python
    $python = "python"
}

$uvicornArgs = '-m uvicorn ml_api_fastapi:app --app-dir "' + $scriptDir + '" --host 127.0.0.1 --port 8000'

Write-Host "Starting server using: $python $uvicornArgs"
# Start detached process
Start-Process -FilePath $python -ArgumentList $uvicornArgs -WorkingDirectory $scriptDir -WindowStyle Hidden

Write-Host "Server should be running (detached). Check http://127.0.0.1:8000/health"
Pop-Location
