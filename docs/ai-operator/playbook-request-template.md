# YEU CAU BO SUNG TINH HUONG AI ERP

## 1. Ten tinh huong

Vi du:
San pham nao lai nhat nam vua roi?

## 2. Nguoi dung se hoi nhu the nao?

- San pham nao lai nhat?
- Top 10 san pham loi nhuan cao nhat?
- San pham nao ban nhieu nhung lai thap?

## 3. Muc dich quan tri

Giup giam doc biet san pham nao nen tap trung.

## 4. Du lieu can co

- Doanh thu
- Gia von
- So luong ban
- Hoan/huy
- Chiet khau
- Phi van chuyen
- Phi thanh toan
- Chi phi ads phan bo neu co

## 5. Cong thuc tinh

Loi nhuan rong =
Doanh thu thuan - Gia von - chi phi bien doi - ads phan bo neu co.

## 6. Cach tra loi mong muon

Tra bang top san pham theo loi nhuan rong giam dan.

## 7. Co can AI khong?

- `no_ai` neu chi tra bang.
- `small_ai` neu can dien giai ngan.
- `analysis_ai` neu hoi vi sao hoac nen lam gi tiep.

## 8. Co can approval khong?

Khong can neu chi xem bao cao.
Can approval neu tao ke hoach tang ads, nhap hang, dung san pham.

## 9. Test case mau

Cau hoi:
San pham nao lai nhat nam vua roi?

Expected:

```text
intent = product_profit_ranking
workflow = productProfitRankingWorkflow
responseContract = tableReport
tokenMode = no_ai
shouldCallOpenAI = false
```
