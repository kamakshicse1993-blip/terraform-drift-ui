# terraform-drift-ui

Lightweight static UI for InfraOps drift monitoring. The project includes a small Node static server (`server.js`) but if Node isn't installed you can use the included PowerShell server.

Run with PowerShell (no Node required):

```powershell
# From the project root
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
# then open http://localhost:8080
```

Run with Node (if installed):

```powershell
node server.js
# then open http://localhost:8080
```
<img width="959" height="599" alt="Drift_Detection_UI" src="https://github.com/user-attachments/assets/cf9ad279-557b-4266-a786-2b765df55a99" />

Notes
- `index.html`, `app.js`, and `styles.css` provide the UI and demo data.
- `serve.ps1` is a minimal static file server using .NET HttpListener (Windows PowerShell).
