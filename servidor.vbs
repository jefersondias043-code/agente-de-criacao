' Agente - servidor silencioso (sem janela). Sobe o servidor local (app + API do
' VideoGrab) se ainda nao estiver no ar. Idempotente: usado pelo INICIO AUTOMATICO
' (login do Windows) e tambem pode ser executado manualmente.
Option Explicit
Dim sh, fso, base, vgd, url, logf
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
vgd = base & "\videograb-server"
url = "http://localhost:3000"
logf = sh.ExpandEnvironmentStrings("%TEMP%") & "\agente-videograb.log"

If ServerUp() Then WScript.Quit
If sh.Run("cmd /c where node", 0, True) <> 0 Then WScript.Quit

If Not fso.FolderExists(vgd & "\node_modules") Then
  sh.Run "cmd /c cd /d """ & vgd & """ && npm install > """ & logf & """ 2>&1", 0, True
End If

sh.Run "cmd /c cd /d """ & vgd & """ && node server.js > """ & logf & """ 2>&1", 0, False

Function ServerUp()
  On Error Resume Next
  Dim http
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.SetTimeouts 1200, 1200, 1200, 1200
  http.Open "GET", url & "/api/health", False
  http.Send
  ServerUp = (Err.Number = 0 And http.Status = 200)
  On Error GoTo 0
End Function