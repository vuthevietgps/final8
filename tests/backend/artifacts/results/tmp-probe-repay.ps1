param([string]$BaseUrl)
$ErrorActionPreference='Stop'
function Req($Method,$Uri,$Headers=@{},$Body=$null){
  $params=@{ Method=$Method; Uri=$Uri; Headers=$Headers; ContentType='application/json; charset=utf-8' }
  if($Body -and $Method -ne 'GET'){ $params.Body=[System.Text.Encoding]::UTF8.GetBytes($Body) }
  return Invoke-RestMethod @params
}
$login=Req 'POST' "$BaseUrl/auth/login" @{} '{"email":"director@test.com","password":"123456"}'
$h=@{ Authorization = "Bearer $($login.access_token)" }
$ts=Get-Date -Format 'yyyyMMdd-HHmmss'
$loan=Req 'POST' "$BaseUrl/finance/loans" $h ((@{name="Repay Probe $ts"; lenderName='Probe Bank'; principal=5000000; interestRate=12; startDate=(Get-Date).ToString('yyyy-MM-dd'); endDate=(Get-Date).AddMonths(12).ToString('yyyy-MM-dd'); repaymentCycle='monthly'; status='active'}|ConvertTo-Json))
$loanId = if($loan._id){$loan._id}else{$loan.id}
$null=Req 'POST' "$BaseUrl/finance/loans/$loanId/disburse" $h ((@{amount=5000000; date=(Get-Date).ToString('yyyy-MM-dd'); notes='probe disburse'}|ConvertTo-Json))
Start-Sleep -Seconds 32
$fc1=Req 'GET' "$BaseUrl/financial-control/full" $h
$payOpt=Req 'GET' "$BaseUrl/loan-management/loans/$loanId/payment-options" $h
$repay=Req 'POST' "$BaseUrl/loan-management/loans/$loanId/pay" $h ((@{paymentType='principal'; amount=1000000; source='bank_balance'; notes='probe repay'; paymentDate=(Get-Date).ToString('yyyy-MM-dd')}|ConvertTo-Json))
Start-Sleep -Seconds 32
$fc2=Req 'GET' "$BaseUrl/financial-control/full" $h
[pscustomobject]@{
  LoanId=$loanId
  BankBefore=[double]$fc1.bankBalance
  FreeCashBefore=[double]$fc1.freeCash
  CanUseBank=[bool]$payOpt.sources.bankBalance.canUse
  AvailableBank=[double]$payOpt.sources.bankBalance.available
  BankAfter=[double]$fc2.bankBalance
  DebtBefore=[double]$fc1.totalDebtOutstanding
  DebtAfter=[double]$fc2.totalDebtOutstanding
}
