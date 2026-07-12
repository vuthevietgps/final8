# 10 — Testing & Acceptance Criteria

## 1. Unit tests

```text
1. Validate action_plan schema.
2. Validate action type allowlist.
3. Reject blocked action types.
4. Validate idempotencyKey.
5. Validate campaign status PAUSED.
6. Validate campaignBudgetId required.
7. Validate budget increase/decrease policy.
8. Validate currency VND.
9. Validate timezone Asia/Ho_Chi_Minh.
10. Validate landing page allowlist.
11. Validate keyword match type.
12. Validate RSA minimum headlines/descriptions/finalUrls.
13. Mask secrets in DTO/log.
```

## 2. Integration tests

```text
1. Import valid ads_execution_plan.zip.
2. Reject zip có path traversal.
3. Reject missing action_plan.json.
4. Reject duplicate actionId.
5. Reject duplicate idempotencyKey đã executed.
6. provider validateOnly success.
7. provider validateOnly failed → không cho approve.
8. Approve với role sai → forbidden.
9. Execute unapproved action → blocked.
10. Execute khi production disabled → blocked.
```

## 3. E2E trên test account

```text
1. Test connection.
2. Sync accounts.
3. Export ads_live_export.zip.
4. Import plan create Search campaign.
5. Run provider validateOnly.
6. Approve ACT001.
7. Execute ACT001.
8. Sync lại.
9. Kiểm tra campaign PAUSED.
10. Kiểm tra ad group/keyword/RSA tồn tại.
11. Kiểm tra execution log.
```

## 4. Acceptance criteria

Hệ thống đạt MVP khi:

```text
1. Người dùng có thể chỉ dùng Codex để tải dữ liệu ads từ ERP.
2. Codex tải được ads_live_export.zip đầy đủ cấu trúc.
3. File export có expert_analysis_prompt.md.
4. ChatGPT Web trả được ads_execution_plan.zip.
5. Codex import được file này vào ERP.
6. ERP validate schema/business/provider.
7. Người dùng duyệt bằng lệnh trong Codex.
8. Codex gọi ERP approve/execute API.
9. ERP gọi Google Ads API, không phải Codex.
10. Campaign mới luôn PAUSED.
11. Budget update chỉ chạy khi có campaignBudgetId hợp lệ.
12. Không action nào chạy nếu chưa approve.
13. Retry cùng idempotencyKey không tạo trùng.
14. Execution log lưu đủ người duyệt, người execute, before/after, provider request ID và lỗi.
15. Sau execute, ERP sync lại và tạo evaluation sau 3/7 ngày.
```
