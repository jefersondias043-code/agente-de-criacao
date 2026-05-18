param(
  [string]$RepoName = "agente-de-postagem",
  [string]$Description = "Agente de Postagem - criação de matérias com IA"
)

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  AGENTE DE POSTAGEM - DEPLOY" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check for token
$token = $env:GH_TOKEN
if (-not $token) {
  $token = Read-Host "GitHub Personal Access Token (crie em https://github.com/settings/tokens com escopo 'repo')"
  if (-not $token) { Write-Host "Token necessário." -ForegroundColor Red; exit 1 }
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}

# Create repo
Write-Host "Criando repositório '$RepoName'..." -ForegroundColor Yellow
$body = @{
  name = $RepoName
  description = $Description
  auto_init = $false
  "private" = $false
} | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body -UseBasicParsing
  Write-Host "Repositório criado com sucesso!" -ForegroundColor Green
} catch {
  Write-Host "Erro ao criar repositório: $_" -ForegroundColor Red
  exit 1
}

# Push
$remoteUrl = "https://jefersondias043-code@github.com/jefersondias043-code/$RepoName.git"
Write-Host "Configurando remote e fazendo push..." -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin $remoteUrl
git branch -M main
$env:GIT_ASKPASS = "echo"
$env:GIT_TOKEN = $token
$env:GIT_USER = "jefersondias043-code"

# Use credential helper with token
git -c "http.extraheader=AUTHORIZATION: bearer $token" push -u origin main 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push falhou. Tente com: git push -u origin main" -ForegroundColor Red
  exit 1
}
Write-Host "Código enviado ao GitHub!" -ForegroundColor Green

# Enable GitHub Pages via API
Write-Host "Ativando GitHub Pages..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$pagesBody = @{
  source = @{
    branch = "main"
    path = "/"
  }
} | ConvertTo-Json

try {
  $pagesResp = Invoke-RestMethod -Uri "https://api.github.com/repos/jefersondias043-code/$RepoName/pages" -Method POST -Headers $headers -Body $pagesBody -UseBasicParsing
  Write-Host "GitHub Pages ativado!" -ForegroundColor Green
} catch {
  Write-Host "Aviso: GitHub Pages pode precisar ser ativado manualmente em Settings > Pages." -ForegroundColor Yellow
  Write-Host "Erro: $_" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  DEPLOY CONCLUÍDO!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Acesse seu app em:" -ForegroundColor White
Write-Host "  https://jefersondias043-code.github.io/$RepoName/" -ForegroundColor Cyan
Write-Host ""
Write-Host "No iPhone:" -ForegroundColor White
Write-Host "  1. Abra o Safari e acesse a URL acima" -ForegroundColor White
Write-Host "  2. Toque no ícone Compartilhar" -ForegroundColor White
Write-Host "  3. Role para baixo e toque 'Adicionar à Tela de Início'" -ForegroundColor White
Write-Host "  4. Toque 'Adicionar'" -ForegroundColor White
Write-Host ""
