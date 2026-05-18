Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  AGENTE DE POSTAGEM - SERVIDOR LOCAL" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$port = 8080
$dir = Split-Path -Parent $PSCommandPath

Write-Host "Iniciando servidor na porta $port..." -ForegroundColor Yellow
Write-Host ""

$serverCode = @"
const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};
const dir = '$($dir.Replace("\","\\"))';
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const fp = path.join(dir, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.statusCode = 404; res.end('404'); return; }
    const ext = path.extname(p);
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  });
});
const port = $port;
srv.listen(port, '0.0.0.0', () => {
  const os = require('os');
  const ifs = os.networkInterfaces();
  let ips = [];
  Object.keys(ifs).forEach(k => {
    ifs[k].forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); });
  });
  console.log('');
  console.log('Servidor rodando!');
  console.log('');
  console.log('  No computador:  http://localhost:' + port);
  console.log('');
  console.log('  No iPhone (WiFi):');
  ips.forEach(ip => console.log('    http://' + ip + ':' + port));
  console.log('');
  console.log('Certifique-se de que o iPhone está na mesma rede WiFi.');
  console.log('Pressione Ctrl+C para parar.');
});
"@

$nodePath = (Get-Command node).Source
Start-Process -FilePath $nodePath -ArgumentList "-e", $serverCode -NoNewWindow -Wait
