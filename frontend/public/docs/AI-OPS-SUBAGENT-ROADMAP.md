# Lo trinh nang cap AI Ops Assistant

Ngay cap nhat: 2026-06-09

Tai lieu nay mo ta cach van hanh va nang cap tro ly AI van hanh theo nhieu subagent. Nguyen tac mac dinh: AI duoc doc, tong hop va de xuat; moi hanh dong ghi ERP hoac thay doi van hanh phai qua nguoi duyet.

## 1. Trang thai hien tai

He thong da co cac thanh phan nen:

1. AI Assistant tong hop tri thuc ERP, workflow va route theo tinh huong.
2. OpenAI Config luu API key dang ma hoa, tra ve UI bang key da mask.
3. Ops Actions tao goi y van hanh tu cong no NCC, cong no dai ly va canh bao ads.
4. Ops Action Plan luu plan/task approval-only tu goi y hien tai.
5. Man Ops Actions cho phep tao plan, xem task pending, duyet hoac tu choi task ma khong tu dong thuc thi live.

Hop dong an toan hien tai:

1. `executionMode = approval_only_no_live_apply`.
2. `liveApplyEnabled = false`.
3. Approve/reject chi ghi nhan trang thai va nguoi thao tac.
4. Task duoc tao tu snapshot goi y, khong goi API ghi den module nghiep vu.

## 2. Subagent de nghi

### 2.1 Router Agent

Muc tieu: xac dinh vai tro nguoi dung, scenario, intent va module ERP lien quan.

Du lieu vao:

1. Noi dung chat.
2. Role hien tai.
3. API catalog.
4. Scenario workflows.

Ket qua ra:

1. `scenarioId`.
2. `intent`.
3. `apiSufficiency`.
4. `executionMode`.
5. Co can approval hay khong.

### 2.2 Data Readiness Agent

Muc tieu: danh gia du lieu nao san sang, du lieu nao thieu truoc khi tra loi.

Nguon du lieu:

1. ERP API catalog.
2. OpenAI Config active/default.
3. Ops data sources.
4. Chat/session history.

Ket qua ra:

1. Danh sach data source ok/warn/fail.
2. Ly do thieu du lieu.
3. Khuyen nghi man hinh can mo de bo sung du lieu.

### 2.3 Ops Suggestion Agent

Muc tieu: tong hop viec can lam trong ngay tu cac module van hanh.

Nguon du lieu hien tai:

1. Supplier payable.
2. Agent receivable.
3. Ads alerts.

Ket qua ra:

1. Danh sach goi y uu tien `critical`, `high`, `medium`, `low`.
2. Ly do tao goi y.
3. Link handoff den man hinh xu ly.
4. Snapshot `asOf` de truy vet.

### 2.4 Approval Planner Agent

Muc tieu: chuyen goi y thanh plan/task co the duyet.

Trang thai task:

1. `pending`.
2. `approved`.
3. `rejected`.

Trang thai plan:

1. `draft`.
2. `pending_approval`.
3. `partially_approved`.
4. `approved`.
5. `rejected`.

Gioi han an toan:

1. Khong ghi vao module nghiep vu.
2. Khong goi API thanh toan, dieu chinh ngan sach, sync live.
3. Chi luu log approval va ket qua `applied=false`.

### 2.5 Finance Risk Agent

Muc tieu: danh gia tac dong tai chinh truoc khi de xuat hanh dong.

Nen bo sung o pha tiep theo:

1. Kiem tra cashflow truoc khi goi y thanh toan NCC.
2. Kiem tra cong no dai ly qua han.
3. Kiem tra bien loi nhuan theo ad group/product.
4. Gan muc do rui ro vao Ops Action Plan.

### 2.6 Ads Optimization Agent

Muc tieu: doc du lieu ads va de xuat toi uu ngan sach, token, ad group.

Gioi han hien tai:

1. Chi handoff sang AI Marketing hoac Ads Budget.
2. Chua apply ngan sach live.
3. Moi thay doi ngan sach phai qua approval rieng.

### 2.7 QA Guardrail Agent

Muc tieu: tu dong nhac cac gate can pass truoc khi bat tinh nang moi.

Gate hien tai:

1. Backend unit test.
2. Backend build.
3. Frontend unit test.
4. Frontend build.
5. Targeted PowerShell regression cho OpenAI Config va Ops Actions.

## 3. Lo trinh nang cap

### Pha 1 - Nen an toan

Da thuc hien:

1. Ma hoa OpenAI API key.
2. Mask API key tren response UI.
3. Bo qua `placeholder-key` khi chon config de AI su dung.
4. Them Ops Action Plan approval-only.
5. Them UI hang doi duyet van hanh.

Tieu chi pass:

1. Khong lo `apiKeyEnc` ra response.
2. `pickConfig()` tra ve key giai ma noi bo.
3. Approve/reject task khong thuc thi live.

### Pha 2 - Dieu phoi subagent

Da thuc hien MVP:

1. Them `agentTrace` cho AI Operator chat/context.
2. Luu `agentTrace` vao lich su message.
3. Hien thi `Agent trace` trong AI Assistant.
4. Trace gom cac buoc `router`, `data_readiness`, `ops_suggestion`, `approval_planner`, `openai_responder` hoac `rule_based_responder`.

Nen lam tiep:

1. Gan moi goi y voi subagent tao ra no o cap recommendation/task.
2. Hien thi data gap ro rang hon trong UI trace.
3. Tach API cho `router`, `readiness`, `opsSuggestion`, `approvalPlanner`.
4. Them analytics cho ty le agent trace warn/blocked.

Tieu chi pass:

1. Moi cau tra loi biet duoc agent nao tham gia.
2. Moi task biet duoc nguon du lieu va thoi diem snapshot.
3. UI hien canh bao khi API catalog hoac OpenAI Config chua san sang.

### Pha 3 - Risk scoring truoc approval

Nen lam tiep:

1. Them truong `riskScore`, `riskLevel`, `riskReasons` vao task.
2. Check cashflow truoc khi de xuat thanh toan.
3. Check ad performance truoc khi de xuat tang/giam ngan sach.
4. Them filter UI theo risk level.

Tieu chi pass:

1. Task co risk reason ro rang.
2. Task rui ro cao khong the approve neu thieu du lieu bat buoc.
3. Regression co case du lieu thieu va case du lieu du.

### Pha 4 - Execution request co kiem soat

Chi nen lam sau khi Pha 3 on dinh.

Huong thiet ke:

1. Approve task chi tao `executionRequest`.
2. `executionRequest` can quyen cao hon de apply.
3. Moi apply phai idempotent, co audit log va co rollback/compensation neu module ho tro.
4. Mac dinh van tat live apply bang config.

Tieu chi pass:

1. Khong co execution nao chay neu config live apply tat.
2. Moi execution co actor, timestamp, payload hash va ket qua.
3. Test replay khong tao double-write.

### Pha 5 - Learning loop

Nen lam sau khi co du lich su approval.

Huong thiet ke:

1. Thu feedback dung/sai tu AI Assistant.
2. Do ty le task duoc approve, reject, het han.
3. Cap nhat prompt/playbook theo du lieu thuc te.
4. Canh bao khi subagent tao qua nhieu goi y bi reject.

## 4. API lien quan

OpenAI Config:

1. `POST /api/openai-configs`
2. `GET /api/openai-configs`
3. `GET /api/openai-configs/:id`
4. `PATCH /api/openai-configs/:id`
5. `POST /api/openai-configs/test-key`

Ops Actions:

1. `GET /api/ops-actions/suggestions`
2. `POST /api/ops-actions/plans/from-suggestions`
3. `GET /api/ops-actions/plans`
4. `GET /api/ops-actions/plans/:planId`
5. `GET /api/ops-actions/tasks`
6. `PATCH /api/ops-actions/plans/:planId/tasks/:taskId/approve`
7. `PATCH /api/ops-actions/plans/:planId/tasks/:taskId/reject`

## 5. Kiem thu da chay

Ket qua gan nhat:

1. Backend unit test: pass.
2. Backend build: pass.
3. Frontend unit test: pass.
4. Frontend build: pass.
5. `module.media-chat-config.ps1`: `33 PASS / 0 FAIL`.
6. `module.order-sheet-sync-ops.ps1`: `56 PASS / 0 FAIL`.
7. `ai-operator.service.spec.ts`: pass cho contract `agentTrace`.

Ghi chu: frontend build hien con warning CSS budget cu o `ads-budget`, khong thuoc pham vi AI Ops.

## 6. Nguyen tac van hanh

1. Khong nhap OpenAI API key vao log, chat, screenshot hoac tai lieu.
2. Khong dung `placeholder-key` cho van hanh that.
3. Moi task co tac dong tien, ngan sach, cong no hoac sync live phai qua approval.
4. Khi AI thieu du lieu, cau tra loi phai noi ro du lieu thieu thay vi doan.
5. Khi co loi, uu tien giu du lieu goc va tao task kiem tra thu cong.
