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

# Sobe o servidor do VideoGrab (videograb-server/) em janela propria, para o
# download de videos funcionar sem passos manuais. O card de status do VideoGrab
# detecta a conexao sozinho.
$vgDir = Join-Path $dir 'videograb-server'
if (Test-Path (Join-Path $vgDir 'server.js')) {
  if (Test-Path (Join-Path $vgDir 'node_modules')) {
    Write-Host "Iniciando o servidor do VideoGrab (http://localhost:3000)..." -ForegroundColor Yellow
    Start-Process -FilePath $nodePath -ArgumentList 'server.js' -WorkingDirectory $vgDir -WindowStyle Minimized
  } else {
    Write-Host "VideoGrab: rode 'npm install' em videograb-server/ para habilitar o download de videos." -ForegroundColor DarkYellow
  }
  Write-Host ""
}

Start-Process -FilePath $nodePath -ArgumentList "-e", $serverCode -NoNewWindow -Wait
