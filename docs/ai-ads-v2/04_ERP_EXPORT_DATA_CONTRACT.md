# 04 — ERP Export Data Contract

## 1. Mục tiêu

ERP phải xuất dữ liệu đầy đủ để ChatGPT Web phân tích như chuyên gia.

Tên file:

```text
ads_live_export_<exportId>.zip
```

Ví dụ:

```text
ads_live_export_EXP-20260611-001.zip
```

## 2. Cấu trúc bắt buộc

```text
ads_live_export_EXP-20260611-001.zip
├── manifest.json
├── operator_readme.md
├── expert_analysis_prompt.md
├── data_dictionary.md
├── decision_rules.json
├── data_quality_report.json
├── google_accounts.csv
├── campaigns.csv
├── campaign_budgets.csv
├── ad_groups.csv
├── keywords.csv
├── responsive_search_ads.csv
├── daily_metrics_campaign.csv
├── daily_metrics_ad_group.csv
├── daily_metrics_keyword.csv
├── daily_metrics_ad.csv
├── products.csv
├── inventory.csv
├── order_profit_attribution.csv
├── landing_pages.csv
├── creative_assets.csv
├── change_log.csv
├── business_daily_notes.csv
└── export_summary.md
```

## 3. `manifest.json`

```json
{
  "schemaVersion": "2.0",
  "exportId": "EXP-20260611-001",
  "generatedAt": "2026-06-11T08:00:00+07:00",
  "generator": "erp-google-ads-export",
  "provider": "google",
  "timezone": "Asia/Ho_Chi_Minh",
  "currency": "VND",
  "dateFrom": "2026-05-28",
  "dateTo": "2026-06-11",
  "liveOnly": true,
  "includeRecentlyPausedDays": 3,
  "analysisPromptFile": "expert_analysis_prompt.md",
  "decisionRulesFile": "decision_rules.json",
  "files": []
}
```

## 4. `google_accounts.csv`

```csv
customerId,loginCustomerId,accountName,currencyCode,timeZone,managerAccountId,isMccLinked,status,lastSyncAt
```

## 5. `campaigns.csv`

```csv
customerId,campaignId,resourceName,campaignName,status,advertisingChannelType,biddingStrategyType,campaignBudgetId,campaignBudgetResourceName,startDate,endDate,internalProductId,lastSyncAt
```

## 6. `campaign_budgets.csv`

```csv
customerId,campaignBudgetId,resourceName,name,amountMicros,amountVnd,deliveryMethod,explicitlyShared,status,lastSyncAt
```

Bắt buộc có `campaignBudgetId` hoặc `resourceName`. Không được đoán budget ID từ campaign/ad group ID.

## 7. `ad_groups.csv`

```csv
customerId,campaignId,adGroupId,resourceName,adGroupName,status,type,cpcBidMicros,internalAdGroupId,internalProductIds,lastSyncAt
```

## 8. `keywords.csv`

```csv
customerId,campaignId,adGroupId,criterionId,resourceName,keywordText,matchType,negative,status,qualityScore,lastSyncAt
```

## 9. `responsive_search_ads.csv`

```csv
customerId,campaignId,adGroupId,adId,resourceName,status,headlines,descriptions,finalUrls,path1,path2,policyApprovalStatus,policyReviewStatus,creativeAssetId,lastSyncAt
```

`headlines`, `descriptions`, `finalUrls` có thể là JSON string.

## 10. Daily metrics

### `daily_metrics_campaign.csv`

```csv
date,customerId,campaignId,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,allConversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,cancelledOrders,profitPerSpend,roas
```

### `daily_metrics_ad_group.csv`

```csv
date,customerId,campaignId,adGroupId,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,allConversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,cancelledOrders,profitPerSpend,roas
```

### `daily_metrics_keyword.csv`

```csv
date,customerId,campaignId,adGroupId,criterionId,keywordText,matchType,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,profitPerSpend,roas
```

### `daily_metrics_ad.csv`

```csv
date,customerId,campaignId,adGroupId,adId,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,profitPerSpend,roas
```

## 11. Business data

### `products.csv`

```csv
productId,productName,category,sellingPrice,costOfGoods,grossMarginPercent,minStock,priority,isActive,defaultLandingPage,note
```

### `inventory.csv`

```csv
productId,onHand,available,reserved,minStock,maxStock,lastUpdatedAt,stockRisk
```

### `order_profit_attribution.csv`

```csv
orderId,orderDate,confirmedDate,customerId,campaignId,adGroupId,adId,criterionId,productId,quantity,revenue,grossProfit,adsCostAllocated,fulfillmentCost,saleCommission,refundAmount,netProfit,orderStatus,paymentStatus,attributionType,attributionConfidence
```

Không xuất PII: tên, số điện thoại, email, địa chỉ.

### `landing_pages.csv`

```csv
landingPageId,url,domain,title,productId,status,approvedForAds,mainCta,notes,lastCheckedAt
```

### `creative_assets.csv`

```csv
creativeAssetId,productId,landingPageUrl,angle,hook,offer,proof,cta,complianceNote,approvedForAds,createdAt
```

### `change_log.csv`

```csv
changeTime,provider,customerId,campaignId,adGroupId,adId,criterionId,changeType,beforeValue,afterValue,reason,changedBy,sourcePlanId,sourceActionId,expectedResult
```

### `business_daily_notes.csv`

```csv
date,noteType,note,affectedCustomerId,affectedCampaignId,affectedAdGroupId,affectedProductId,severity
```

## 12. `data_quality_report.json`

```json
{
  "exportId": "EXP-20260611-001",
  "status": "passed_with_warnings",
  "warnings": [],
  "missingFiles": [],
  "missingColumns": [],
  "duplicateKeys": [],
  "attributionCoverage": {
    "ordersWithAdGroupIdPercent": 92,
    "ordersWithKeywordIdPercent": 38
  }
}
```
