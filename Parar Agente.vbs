' Agente - encerra o servidor local do app/VideoGrab (porta 3000), sem janela.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort 3000 -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }""", 0, True
MsgBox "Servidor do Agente encerrado.", 64, "Agente"

