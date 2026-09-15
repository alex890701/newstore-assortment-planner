param([switch]$Keep)
# 停止本机跑在 3020 的 node 服务
$conns = Get-NetTCPConnection -LocalPort 3020 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
  if ($p) { Write-Output ("kill " + $p.Id + " " + $p.ProcessName); Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 600
Write-Output 'stopped'
