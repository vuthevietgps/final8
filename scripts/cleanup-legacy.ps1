# Cleanup legacy POC modules and dev scripts
$ErrorActionPreference = 'SilentlyContinue'

$paths = @(
  # Dev scripts
  'C:\Users\PC\Documents\code\final8-new\backend\src\backfill-order-phone.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\check-conversations.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\create-demo-conversation.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\create-demo-users.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\debug-token.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\fix-token.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-text-processing.js',
  # Summary4
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-calculator.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-google-sync.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-maintenance.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-payment.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-query.util.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-repository.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-stats.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4-sync.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4.controller.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4.module.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\summary4.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\dto\summary4-filter.dto.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\dto\update-manual-payment.dto.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\schemas\summary4.schema.ts',
  # Summary5
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\summary5.controller.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\summary5.module.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\summary5.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\dto\summary5-filter.dto.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\schemas\summary5.schema.ts',
  # Test-order2
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2-export-json.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2-export.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2-import.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2-mapper.util.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2-query.util.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2-sync.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2.controller.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2.module.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2.policy.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2.repository.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\test-order2.service.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\dto\create-test-order2.dto.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\dto\update-delivery-status.dto.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\dto\update-test-order2.dto.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\interfaces\delete-response.interface.ts',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\schemas\test-order2.schema.ts'
)

$deleted = 0
foreach ($p in $paths) {
  if (Test-Path $p) {
    Remove-Item -Path $p -Force
    Write-Host "Deleted: $p"
    $deleted++
  }
}

# Remove empty directories for the modules
$dirs = @(
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\dto',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4\schemas',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary4',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\dto',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5\schemas',
  'C:\Users\PC\Documents\code\final8-new\backend\src\summary5',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\dto',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\interfaces',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2\schemas',
  'C:\Users\PC\Documents\code\final8-new\backend\src\test-order2'
)

foreach ($d in $dirs) {
  if (Test-Path $d) {
    $items = Get-ChildItem -Path $d -Force
    if ($items.Count -eq 0) {
      Remove-Item -Path $d -Force
      Write-Host "Removed empty dir: $d"
    }
  }
}

Write-Host "Cleanup complete. Deleted files: $deleted" -ForegroundColor Green
exit 0
