export type AiOperatorAudience =
  | 'director'
  | 'manager'
  | 'sales'
  | 'ads'
  | 'accountant'
  | 'employee'
  | 'agent'
  | 'supplier';

export interface ErpApiCatalogItem {
  domain: string;
  purpose: string;
  readEndpoints: string[];
  writeEndpoints: string[];
  aiUseCases: string[];
  guardrails: string[];
}

export interface RolePlaybook {
  role: AiOperatorAudience;
  title: string;
  summary: string;
  dailyQuestions: string[];
  frequentScenarios: string[];
  recommendedModules: string[];
  allowedAiActions: string[];
  restrictedAiActions: string[];
}

export type ApiSufficiency = 'sufficient' | 'partial' | 'missing';
export type ExecutionMode = 'read_only' | 'approval_required' | 'manual_handoff';

export interface ScenarioWorkflow {
  scenarioId: string;
  roles: AiOperatorAudience[];
  title: string;
  trigger: string;
  goal: string;
  readApis: string[];
  writeApis: string[];
  apiSufficiency: ApiSufficiency;
  missingDataOrApi: string[];
  executionMode: ExecutionMode;
  approvalRequired: boolean;
  guardrails: string[];
}

export interface QuestionPlaybookGroup {
  groupId: string;
  title: string;
  questions: string[];
  defaultIntents: string[];
  primaryReadApis: string[];
  analysisSteps: string[];
  responseRules: string[];
  guardrails: string[];
  dataGaps: string[];
}

export const ERP_API_CATALOG: ErpApiCatalogItem[] = [
  {
    domain: 'Auth, User, RBAC',
    purpose: 'Dang nhap, xac thuc token, quan ly nguoi dung, vai tro va quyen truy cap ERP.',
    readEndpoints: ['GET /api/users', 'POST /api/auth/validate-token', 'GET /api/session-logs/me'],
    writeEndpoints: ['POST /api/auth/login', 'POST /api/users', 'PATCH /api/users/:id', 'DELETE /api/users/:id'],
    aiUseCases: [
      'Giai thich user nao co quyen vao module nao.',
      'Kiem tra role/permission truoc khi de xuat thao tac quan tri.',
      'Tong hop nhan su dang thieu quyen de van hanh module.'
    ],
    guardrails: [
      'Khong tu dong tao/xoa user hoac doi role neu chua co xac nhan ro cua director.',
      'Khong bao gio hien thi JWT, password hoac secret trong cau tra loi.'
    ]
  },
  {
    domain: 'Order, Status, Fulfillment',
    purpose: 'Quan ly don hang, trang thai san xuat, giao hang, cap nhat tracking va dong bo sheet.',
    readEndpoints: [
      'GET /api/test-order2',
      'GET /api/order-status',
      'GET /api/production-status',
      'GET /api/delivery-status',
      'GET /api/order-sheet-sync/status',
      'GET /api/order-sheet-sync/agents-suppliers'
    ],
    writeEndpoints: [
      'POST /api/test-order2',
      'PATCH /api/test-order2/:id',
      'POST /api/order-update/excel',
      'POST /api/order-sheet-sync/agents/all',
      'POST /api/order-sheet-sync/suppliers/all'
    ],
    aiUseCases: [
      'Tom tat don moi, don tre, don loi tracking va don can doi soat.',
      'Goi y viec can lam theo trang thai don hang.',
      'Giai thich luong tu don hang sang cong no NCC/hoa hong dai ly.'
    ],
    guardrails: [
      'Khong doi supplier, agent, gia tien hoac trang thai thanh toan neu khong co ID don va xac nhan.',
      'Voi supplier user, chi de xuat thao tac trong pham vi don cua supplier do.'
    ]
  },
  {
    domain: 'Product, Customer, Quote',
    purpose: 'Quan ly san pham, nhom san pham, khach hang, bao gia dai ly va bao gia NCC.',
    readEndpoints: ['GET /api/products', 'GET /api/product-category', 'GET /api/customers', 'GET /api/quotes', 'GET /api/supplier-quotes'],
    writeEndpoints: ['POST /api/products', 'PATCH /api/products/:id', 'MISSING POST /api/customers', 'POST /api/quotes', 'POST /api/supplier-quotes'],
    aiUseCases: [
      'Tra cuu san pham/bao gia khi sale hoac dai ly can chot don.',
      'Phat hien san pham thieu gia, thieu media hoac chua co bao gia NCC.',
      'Tong hop san pham co loi nhuan/thua lo theo du lieu bao cao.'
    ],
    guardrails: [
      'Khong tu sua gia ban/gia NCC neu chua co nguoi duyet.',
      'Neu du lieu gia bi thieu, noi ro module nao can cap nhat.'
    ]
  },
  {
    domain: 'Ads, KPI, Alerts',
    purpose: 'Quan ly tai khoan quang cao, nhom quang cao, chi phi ads, KPI nhan vien ads va canh bao ROI.',
    readEndpoints: [
      'GET /api/ad-accounts',
      'GET /api/ad-groups',
      'GET /api/ads/ad-groups/profit-classification?days=7',
      'GET /api/advertising-cost/stats/summary',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/ad-group-profit-report/optimal-spend',
      'GET /api/employee-ads-kpi',
      'GET /api/ads-alerts',
      'GET /api/ai-marketing/overview',
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/ai-marketing/creatives/performance',
      'GET /api/ai-marketing/creatives',
      'GET /api/ai-marketing/plans',
      'GET /api/ai-marketing/actions/evaluations'
    ],
    writeEndpoints: [
      'POST /api/advertising-cost/upload-facebook-excel',
      'POST /api/advertising-cost/fetch/facebook',
      'POST /api/employee-ads-kpi/assign',
      'POST /api/ai-marketing/leads/sync',
      'POST /api/ai-marketing/creatives',
      'PATCH /api/ai-marketing/creatives/:creativeId',
      'POST /api/ai-marketing/plans/generate',
      'PATCH /api/ai-marketing/plans/:planId/items/:itemId/approve',
      'POST /api/ai-marketing/plans/:planId/apply',
      'POST /api/emergency-actions/bulk-sync'
    ],
    aiUseCases: [
      'Chi ra nhom ads dang lo, nhom co the scale va nhom can tam dung.',
      'Dem va phan loai nhom quang cao theo lai, lo, hoa von va chua du du lieu.',
      'Tom tat KPI nhan vien ads de manager phan cong viec.',
      'Giai thich vi sao de xuat tang/giam ngan sach dua tren ROI, loi nhuan va cashflow.',
      'Theo doi creative nao tao lead/khach/lai that de lap creative_test truoc khi scale.'
    ],
    guardrails: [
      'Moi de xuat scale/kill ads phai xet cashflow va survival floor truoc ROI.',
      'Khong apply ngan sach that neu chua co phe duyet va gioi han thay doi.'
    ]
  },
  {
    domain: 'Finance, Cashflow, Capital, Owner Fund',
    purpose: 'Theo doi bank balance, free cash, committed cash, forecast, von kha dung, phan bo von, khoan vay va quy owner.',
    readEndpoints: [
      'GET /api/financial-control/dashboard',
      'GET /api/finance/available-funds/current',
      'GET /api/finance/cashflow-health',
      'GET /api/capital-allocation/compute',
      'GET /api/budget-allocation/status',
      'GET /api/finance/loans',
      'GET /api/owner-fund/fund-summary'
    ],
    writeEndpoints: [
      'POST /api/finance/available-funds/capture',
      'POST /api/capital-allocation/snapshots',
      'POST /api/budget-allocation/auto',
      'POST /api/finance/loans',
      'POST /api/finance/loans/:id/repayments',
      'POST /api/owner-fund/withdrawals'
    ],
    aiUseCases: [
      'Tom tat suc khoe dong tien hom nay cho giam doc.',
      'Goi y ngan sach ads an toan dua tren free cash va survival floor.',
      'Canh bao rut owner, tra no, chi ads khi dong tien cang.'
    ],
    guardrails: [
      'Phan biet tien that da vao/ra voi doanh thu/chi phi ke toan.',
      'Rut owner, tra no, auto budget la thao tac rui ro cao, luon can xac nhan.'
    ]
  },
  {
    domain: 'Supplier Payable, Agent Payment',
    purpose: 'Doi soat NCC thu COD, thanh toan NCC, tinh hoa hong dai ly va xu ly cong no/clawback.',
    readEndpoints: [
      'GET /api/supplier-payables/statements',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/test-order2/payment-pending/supplier',
      'GET /api/test-order2/payment-pending/agent',
      'GET /api/agent-receivables/summary',
      'GET /api/agent-payables/summary/cashflow'
    ],
    writeEndpoints: [
      'POST /api/supplier-payables/statements',
      'POST /api/supplier-payables/statements/:id/payments',
      'PATCH /api/supplier-payables/statements/:id/close',
      'POST /api/test-order2/supplier-payment-batch',
      'POST /api/test-order2/agent-payment-batch/atomic'
    ],
    aiUseCases: [
      'Tong hop khoan NCC qua han, dai ly can thanh toan va batch dang tre.',
      'Giai thich vi sao mot don duoc/khong duoc dua vao batch thanh toan.',
      'Canh bao batch lon can duyet truoc khi tao.'
    ],
    guardrails: [
      'Khong tao batch thanh toan neu chua co danh sach ID, tong tien, chu ky va nguoi duyet.',
      'Voi hoa hong am/hoan sau tra, can noi ro rui ro clawback.'
    ]
  },
  {
    domain: 'AI, Chat, Token, Integration',
    purpose: 'Quan ly OpenAI config, hoi thoai, fanpage, token Meta/Google/TikTok va sync platform.',
    readEndpoints: ['GET /api/openai-configs', 'GET /api/chat-messages/conversations/list/all', 'GET /api/fanpages', 'GET /api/api-tokens', 'GET /api/api-tokens/settings'],
    writeEndpoints: [
      'POST /api/openai-configs',
      'PATCH /api/openai-configs/:id',
      'POST /api/openai-configs/test-key',
      'POST /api/api-tokens',
      'POST /api/api-tokens/:id/validate',
      'POST /api/api-tokens/:id/rotate',
      'POST /api/api-tokens/sync/from-fanpages'
    ],
    aiUseCases: [
      'Huong dan cau hinh AI API token va prompt dung cho chatbot.',
      'Kiem tra token ads het han, sync loi va de xuat rotate.',
      'Tong hop hoi thoai/pending order de manager biet diem nghen.'
    ],
    guardrails: [
      'Khong hien thi day du API key/token trong UI, log hoac cau tra loi AI.',
      'Rotate token va sync dien rong can xac nhan platform, pham vi va thoi diem.'
    ]
  }
];

export const ROLE_PLAYBOOKS: RolePlaybook[] = [
  {
    role: 'director',
    title: 'Giam doc',
    summary: 'Ra quyet dinh ve dong tien, scale/kill ads, rut owner, von, rui ro va phan quyen.',
    dailyQuestions: [
      'Hom nay free cash va runway co an toan khong?',
      'Nhom ads nao nen tang/giam/tam dung neu xet ca ROI va dong tien?',
      'Cong no NCC/dai ly nao qua han hoac anh huong cashflow?',
      'Co thao tac nao can phe duyet trong ngay?'
    ],
    frequentScenarios: [
      'Duyet ngan sach ads khi ROI tot nhung cashflow cang.',
      'Quyet dinh rut owner hoac giu lai von an toan.',
      'Xu ly canh bao chi phi, khoan vay den han, batch thanh toan lon.',
      'Kiem tra user/quyen khi mo module moi.'
    ],
    recommendedModules: ['financial-control', 'finance', 'owner-fund', 'ads-budget', 'ad-group-profit-report', 'supplier-payable', 'agent-receivable'],
    allowedAiActions: ['Tong hop', 'xep uu tien', 'de xuat quyet dinh', 'tao checklist phe duyet'],
    restrictedAiActions: ['Tu dong rut tien', 'tu dong apply ngan sach lon', 'tu dong xoa user', 'tu dong tao batch thanh toan']
  },
  {
    role: 'manager',
    title: 'Quan ly',
    summary: 'Dieu phoi van hanh ngay, theo doi ads KPI, canh bao, don hang, token va ban giao cho director.',
    dailyQuestions: [
      'Viec nong nao can xu ly truoc 10h?',
      'Nhan vien ads nao qua tai hoac dang tut KPI?',
      'Don hang, fanpage, token, sync nao dang gay nghen?',
      'Cuoi ngay can ban giao rui ro nao cho giam doc?'
    ],
    frequentScenarios: [
      'Phan cong nguoi xu ly alert ROI thap.',
      'Kiem tra backlog hoi thoai/pending order.',
      'Bao cao ngan sach ads can duyet.',
      'Xu ly token platform loi 401/403/429 hoac sync that bai.'
    ],
    recommendedModules: ['ads-budget', 'employee-ads-kpi', 'ops-action', 'chat-message', 'fanpage', 'api-token', 'media'],
    allowedAiActions: ['Lap checklist', 'de xuat owner', 'tong hop alert', 'soan ban giao'],
    restrictedAiActions: ['Tu phe duyet tai chinh', 'tu doi token tren dien rong', 'tu apply budget neu vuot rule']
  },
  {
    role: 'sales',
    title: 'Sale / Dai ly ban hang',
    summary: 'Tra cuu san pham, bao gia, khach hang, tao don va theo doi trang thai chot don.',
    dailyQuestions: [
      'San pham nao con du lieu gia va media day du de chot?',
      'Don nao dang can cap nhat thong tin khach/tracking?',
      'Hoa hong nao da du dieu kien thanh toan?',
      'Khach nao can cham lai?'
    ],
    frequentScenarios: [
      'Tao don tu lead/hoi thoai hoac agent.',
      'Tra cuu bao gia dai ly va san pham.',
      'Theo doi don bi tre/trang thai giao hang.',
      'Hoi ve hoa hong pending.'
    ],
    recommendedModules: ['products', 'customers', 'quotes', 'test-order2', 'delivery-status', 'agent-receivable'],
    allowedAiActions: ['Tra cuu', 'tom tat don', 'goi y thong tin can bo sung'],
    restrictedAiActions: ['Doi gia von', 'doi supplier assignment', 'phe duyet thanh toan']
  },
  {
    role: 'ads',
    title: 'Nhan vien Ads',
    summary: 'Theo doi spend, ROI, loi nhuan, alert va de xuat scale/giam/tat nhom quang cao.',
    dailyQuestions: [
      'Nhom ads nao lo, ROI thap hoac dot bien chi phi?',
      'Nhom nao du dieu kien scale nhe/manh?',
      'Token/sync platform co loi khong?',
      'Can them media hay san pham nao truoc khi scale?'
    ],
    frequentScenarios: [
      'Xu ly alert ROI < 50% hoac CRITICAL.',
      'Upload/sync chi phi ads Facebook, Google, TikTok.',
      'Bao cao ad group co loi nhuan tot/xau.',
      'Kiem tra token va tai khoan quang cao.'
    ],
    recommendedModules: ['ad-account', 'ad-group', 'advertising-cost', 'ad-group-profit-report', 'employee-ads-kpi', 'ads-alerts', 'media'],
    allowedAiActions: ['Phan tich ROI', 'goi y scale', 'soan bao cao', 'lap checklist kiem tra token'],
    restrictedAiActions: ['Tu apply budget that', 'tu tat campaign ngoai rule', 'bo qua cashflow khi de xuat scale']
  },
  {
    role: 'accountant',
    title: 'Ke toan / CFO persona',
    summary: 'Doi soat NCC, hoa hong dai ly, chi phi, luong, khoan vay va dong tien that.',
    dailyQuestions: [
      'Khoan NCC/dai ly nao qua han?',
      'Chi phi nao sap den han trong 14 ngay?',
      'Bank balance va committed cash co khop khong?',
      'Batch nao can duyet hoac doi chung tu?'
    ],
    frequentScenarios: [
      'Tao statement NCC theo ky.',
      'Ghi nhan thanh toan NCC/dai ly.',
      'Cap nhat khoan vay va lich tra no.',
      'Doi soat chi phi khac, luong, ads spend proxy.'
    ],
    recommendedModules: ['supplier-payable', 'agent-receivable', 'labor-cost1', 'other-cost', 'finance', 'financial-control'],
    allowedAiActions: ['Tong hop cong no', 'canh bao den han', 'giai thich chenh lech'],
    restrictedAiActions: ['Tu dong dong statement', 'tu dong tao/duyet batch lon', 'nhap so tien khong co chung tu']
  },
  {
    role: 'supplier',
    title: 'Nha cung cap',
    summary: 'Cap nhat trang thai xu ly/giao hang cho don trong pham vi supplier va theo doi doi soat.',
    dailyQuestions: [
      'Don nao can cap nhat san xuat/giao hang?',
      'Tracking nao thieu?',
      'Ky doi soat nao dang mo?',
      'Don nao bi hoan can xu ly?'
    ],
    frequentScenarios: [
      'Cap nhat trackingNumber va trang thai giao hang.',
      'Kiem tra statement NCC.',
      'Tra loi van hanh ve don tre/hoan.',
      'Doi soat COD theo ky.'
    ],
    recommendedModules: ['test-order2', 'delivery-status', 'production-status', 'supplier-payable'],
    allowedAiActions: ['Tom tat don trong pham vi', 'goi y viec can cap nhat'],
    restrictedAiActions: ['Tao/xoa don', 'doi supplier assignment', 'xem tai chinh toan cong ty']
  }
];

export const SCENARIO_WORKFLOWS: ScenarioWorkflow[] = [
  {
    scenarioId: 'DIR-001',
    roles: ['director'],
    title: 'Tong quan dieu hanh dau ngay',
    trigger: 'Giam doc hoi hom nay can xem gi truoc hoac mo dashboard sang.',
    goal: 'Tom tat suc khoe dong tien, ads, don hang, cong no va viec can duyet.',
    readApis: [
      'GET /api/financial-control/dashboard',
      'GET /api/financial-control/forecast',
      'GET /api/financial-control/actions',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/ads-alerts/summary',
      'GET /api/test-order2',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/agent-receivables/summary/cashflow'
    ],
    writeApis: [],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Neu can lead/SLA sale rieng thi hien chua co module lead doc lap.'],
    executionMode: 'read_only',
    approvalRequired: false,
    guardrails: ['Chi tong hop va xep uu tien, khong noi da thuc hien hanh dong.', 'Neu source loi, noi ro module nao khong doc duoc.']
  },
  {
    scenarioId: 'DIR-002',
    roles: ['director'],
    title: 'Duyet scale, giam hoac tam dung ads',
    trigger: 'ROI tot/xau, ads alert critical, manager xin tang/giam ngan sach.',
    goal: 'Quyet dinh ads action dua tren ROI, loi nhuan, cashflow va rule an toan.',
    readApis: [
      'GET /api/ad-group-profit-report/performance',
      'GET /api/ad-group-daily-report/optimal-spend',
      'GET /api/advertising-cost/stats/by-adgroup?adGroupId=...',
      'GET /api/financial-control/dashboard',
      'GET /api/financial-control/optimal-ads',
      'GET /api/budget-allocation/preview',
      'GET /api/ai-marketing/overview',
      'GET /api/ai-marketing/plans',
      'GET /api/ai-marketing/actions/evaluations',
      'GET /api/cashflow/ads/decision'
    ],
    writeApis: [
      'POST /api/ai-marketing/plans/generate',
      'PATCH /api/ai-marketing/plans/:planId/items/:itemId/approve',
      'POST /api/ai-marketing/plans/:planId/apply',
      'POST /api/budget-allocation/auto',
      'POST /api/finance/ad-groups/:id/manual-scale',
      'POST /api/emergency-actions/bulk-sync',
      'PATCH /api/emergency-actions/:taskId/toggle'
    ],
    apiSufficiency: 'sufficient',
    missingDataOrApi: [
      'Creative-level attribution van can Creative Library neu muon AI chon asset/caption tot nhat.',
      'Pause/kill campaign sau hon van phu thuoc BudgetApplyService va platform support.'
    ],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Xet cashflow/survival truoc ROI.', 'Moi thay doi ngan sach lon can director approve va gioi han muc tang/giam.']
  },
  {
    scenarioId: 'DIR-003',
    roles: ['director'],
    title: 'Rut owner hoac giu lai von',
    trigger: 'Chu doanh nghiep muon rut tien, dau tu them ads hoac giu quy an toan.',
    goal: 'Tinh so tien co the rut sau committed cash, survival floor, no den han va batch thanh toan.',
    readApis: [
      'GET /api/financial-control/dashboard',
      'GET /api/funds/owner',
      'GET /api/funds/survival-buffer',
      'GET /api/finance/available-funds/current?mode=conservative',
      'GET /api/finance/repayments/upcoming',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/agent-payables/summary/cashflow',
      'GET /api/owner-fund/fund-summary'
    ],
    writeApis: [
      'POST /api/owner-fund/withdrawals',
      'POST /api/owner-fund/withdrawals/:id/approve',
      'POST /api/owner-fund/withdrawals/:id/complete',
      'POST /api/capital-allocation/snapshots'
    ],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Can them policy theo cong ty neu rule rut owner phuc tap hon cong thuc hien co.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong tao/rut tien neu chua co ownerId, amount, ly do va nguoi duyet.', 'Phan biet tien that va loi nhuan ke toan.']
  },
  {
    scenarioId: 'DIR-004',
    roles: ['director', 'accountant'],
    title: 'Xu ly cang dong tien 7-14 ngay',
    trigger: 'Forecast low point am, runway thap, cashflow alert hoac sap den han tra no/thanh toan.',
    goal: 'Chi ra nguyen nhan cash crunch va action giam rui ro.',
    readApis: [
      'GET /api/financial-control/forecast',
      'GET /api/finance/cashflow-health',
      'GET /api/cashflow/dashboard/summary',
      'GET /api/cashflow/alerts',
      'GET /api/other-cost/summary/cashflow?windowDays=14',
      'GET /api/labor-cost1/summary/cashflow',
      'GET /api/finance/loan-contracts/summary/cashflow?windowDays=14',
      'GET /api/advertising-cost/summary/cashflow'
    ],
    writeApis: [
      'POST /api/budget-allocation/auto',
      'POST /api/finance/loans/:id/repayments',
      'POST /api/finance/repayments/:id/pay',
      'MISSING POST /api/ops-actions'
    ],
    apiSufficiency: 'partial',
    missingDataOrApi: [
      'Chua thay module invoice/bank reconciliation day du de doi soat sao ke ngan hang.',
      'Ads spend hien co the la proxy, chua chac la cash-out that neu chua co Ads Payment module.'
    ],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Neu du lieu la proxy phai noi ro.', 'Uu tien action cat rui ro truoc action scale.']
  },
  {
    scenarioId: 'DIR-005',
    roles: ['director'],
    title: 'Quan tri user, role va mo module',
    trigger: 'Them quan ly/nhan vien/dai ly/NCC, cap quyen module hoac review quyen.',
    goal: 'De xuat role/permission dung voi cong viec va plan dang co.',
    readApis: ['GET /api/users', 'GET /api/plan/info', 'GET /api/session-logs/me'],
    writeApis: ['POST /api/users', 'PATCH /api/users/:id', 'DELETE /api/users/:id'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Permission hien hard-code theo role, chua co permission assignment linh hoat theo user.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong xoa/doi role user neu khong co id va xac nhan director.', 'Khong hien password/token.']
  },
  {
    scenarioId: 'MGR-001',
    roles: ['manager'],
    title: 'Gom viec nong trong ngay',
    trigger: 'Manager mo ca hoac hoi viec nao can xu ly truoc.',
    goal: 'Xep hang viec can lam theo muc do anh huong va owner de xuat.',
    readApis: [
      'GET /api/ops-actions/suggestions',
      'GET /api/emergency-actions',
      'GET /api/emergency-actions/overdue',
      'GET /api/ads-alerts',
      'GET /api/test-order2',
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/fanpages',
      'GET /api/api-tokens/settings'
    ],
    writeApis: ['MISSING POST /api/ops-actions', 'POST /api/emergency-actions/bulk-sync', 'PATCH /api/emergency-actions/:taskId/toggle'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Ops action hien co nhung can chuan hoa status/owner/deadline neu muon AI giao viec that.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['AI chi de xuat owner/deadline, manager xac nhan truoc khi tao task.', 'Khong tu dong dong task neu chua co bang chung.']
  },
  {
    scenarioId: 'MGR-002',
    roles: ['manager'],
    title: 'Phan cong nhan vien Ads',
    trigger: 'Co alert ROI, backlog ads, nhan vien qua tai hoac can gan ad group.',
    goal: 'Chon nguoi xu ly phu hop dua tren KPI, workload va nhom quang cao.',
    readApis: [
      'GET /api/employee-ads-kpi',
      'GET /api/employee-ads-kpi/meta/employees',
      'GET /api/employee-ads-kpi/meta/alerts',
      'GET /api/employee-ads-kpi/:employeeId/ad-groups',
      'GET /api/ad-groups',
      'GET /api/ads-alerts'
    ],
    writeApis: ['POST /api/employee-ads-kpi/assign', 'POST /api/employee-ads-kpi/bulk-assign', 'MISSING POST /api/ops-actions'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Neu can workload theo gio thuc te thi can module timesheet/backlog chi tiet hon.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong bulk-assign neu chua co danh sach employeeId/adGroupId.', 'Can ly do khi doi owner nhom ads dang chay.']
  },
  {
    scenarioId: 'MGR-003',
    roles: ['manager'],
    title: 'Theo doi fanpage, hoi thoai va pending order',
    trigger: 'Inbox tre, auto AI sai, hoi thoai co y dinh mua hang hoac pending order bi tre.',
    goal: 'Chi ra fanpage/conversation can can thiep va don nhap nhap can duyet.',
    readApis: [
      'GET /api/fanpages',
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/chat-messages/conversations/:fanpageId/:senderPsid',
      'GET /api/chat-messages/conversations/:fanpageId/:senderPsid/extract-order',
      'GET /api/pending-orders'
    ],
    writeApis: [
      'PATCH /api/chat-messages/conversations/:fanpageId/:senderPsid/auto-ai',
      'PATCH /api/chat-messages/conversations/:fanpageId/:senderPsid/resolve',
      'POST /api/chat-messages/send',
      'POST /api/pending-orders/:id/approve'
    ],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Can SLA/last response metrics ro rang hon de AI uu tien hoi thoai tre.', 'Lead pipeline rieng chua co.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong gui tin nhan that neu manager chua xac nhan noi dung.', 'Approve pending order can du thong tin bat buoc.']
  },
  {
    scenarioId: 'MGR-004',
    roles: ['manager'],
    title: 'Ban giao cuoi ngay',
    trigger: 'Cuoi ca, manager can handoff cho giam doc hoac ca sau.',
    goal: 'Tong hop ket qua, rui ro, owner, viec can duyet va deadline tiep theo.',
    readApis: [
      'GET /api/financial-control/dashboard',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/employee-ads-kpi',
      'GET /api/ops-actions/suggestions',
      'GET /api/ads-alerts',
      'GET /api/test-order2'
    ],
    writeApis: ['MISSING POST /api/ops-actions'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Chua co endpoint luu bao cao handoff rieng; hien co the dung ops-actions hoac ghi ngoai he thong.'],
    executionMode: 'manual_handoff',
    approvalRequired: false,
    guardrails: ['Khong tao task moi neu chi la bao cao.', 'Neu co de xuat tai chinh/ads, gan nguoi duyet ro.']
  },
  {
    scenarioId: 'SALES-001',
    roles: ['sales', 'agent'],
    title: 'Tao don tu hoi thoai hoac lead',
    trigger: 'Khach da cung cap thong tin mua hang trong fanpage/chat.',
    goal: 'Bien hoi thoai thanh draft/pending order hoac don chinh thuc khi du thong tin.',
    readApis: [
      'GET /api/chat-messages/conversations/:fanpageId/:senderPsid',
      'GET /api/chat-messages/conversations/:fanpageId/:senderPsid/extract-order',
      'GET /api/products',
      'GET /api/products/:id/media',
      'GET /api/quotes',
      'GET /api/customers',
      'GET /api/ad-groups/lookup/:adGroupId'
    ],
    writeApis: ['MISSING POST /api/customers', 'POST /api/pending-orders', 'POST /api/test-order2'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Chua co lead module/doc lap va validation tool thong nhat cho order draft.', 'Customer module chua co endpoint tao customer truc tiep; hien chu yeu sync tu don hang.', 'Can map bat buoc product/supplier/adGroup theo rule tung luong.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong tao don neu thieu sdt/dia chi/san pham/so luong/gia.', 'Can xac nhan thong tin khach truoc khi ghi don.']
  },
  {
    scenarioId: 'SALES-002',
    roles: ['sales', 'agent'],
    title: 'Tra cuu san pham, gia va media de chot don',
    trigger: 'Sale hoi san pham nao ban duoc, gia nao ap dung, media nao nen gui.',
    goal: 'Tra loi nhanh thong tin san pham, bao gia, anh tot va loi nhuan du kien.',
    readApis: [
      'GET /api/products',
      'GET /api/products/:id',
      'GET /api/products/:id/media',
      'GET /api/products/:id/best-images',
      'GET /api/quotes/product/:productId',
      'GET /api/supplier-quotes/effective',
      'GET /api/test-order2/product-profit-report'
    ],
    writeApis: ['POST /api/chat-messages/send', 'POST /api/products/:id/create-fanpage-variant'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Neu can ton kho that theo SKU thi module inventory hien chua duoc dua vao luong order chinh.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong tu sua gia/quote.', 'Noi ro neu media/gia NCC thieu hoac het hieu luc.']
  },
  {
    scenarioId: 'SALES-003',
    roles: ['sales', 'agent'],
    title: 'Theo doi don cham hoac can bo sung thong tin',
    trigger: 'Khach hoi trang thai don, don thieu tracking, don giao tre.',
    goal: 'Tim don lien quan va de xuat cap nhat/thong bao cho khach.',
    readApis: [
      'GET /api/test-order2',
      'GET /api/test-order2/:id',
      'GET /api/order-status',
      'GET /api/production-status',
      'GET /api/delivery-status',
      'GET /api/customers'
    ],
    writeApis: ['PATCH /api/test-order2/:id', 'PATCH /api/test-order2/:id/delivery-status', 'MISSING POST /api/ops-actions', 'POST /api/chat-messages/send'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Can tracking carrier integration neu muon lay trang thai van chuyen tu hang van chuyen.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong doi trang thai giao hang neu chua co nguon xac nhan.', 'Tin nhan cho khach can sale/manager duyet neu co cam ket boi thuong.']
  },
  {
    scenarioId: 'SALES-004',
    roles: ['sales', 'agent'],
    title: 'Hoi hoa hong va cong no dai ly',
    trigger: 'Dai ly hoi don nao duoc tinh hoa hong, batch nao da thanh toan.',
    goal: 'Giai thich hoa hong pending/paid/clawback theo don va batch.',
    readApis: [
      'GET /api/test-order2/payment-pending/agent',
      'GET /api/test-order2/payment-batches/agent',
      'GET /api/test-order2/payment-batch/:batchId/:type',
      'GET /api/agent-receivables/summary/payment',
      'GET /api/agent-payables/statements'
    ],
    writeApis: ['POST /api/test-order2/agent-payment-batch/atomic', 'POST /api/agent-payables/statements'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Can self-service endpoint loc theo current agent de tranh lo du lieu dai ly khac.', 'Can chuan hoa agent-payable vs agent-receivable naming.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Sale/agent chi xem du lieu cua minh.', 'Thanh toan hoa hong do ke toan/manager duyet.']
  },
  {
    scenarioId: 'ADS-001',
    roles: ['ads', 'manager'],
    title: 'Sync chi phi ads va kiem tra suc khoe token',
    trigger: 'Chi phi ads chua ve, dashboard lech, token 401/403/429 hoac sync loi.',
    goal: 'Xac dinh platform/tai khoan loi va de xuat cach sync/rotate an toan.',
    readApis: [
      'GET /api/advertising-cost/sync/health',
      'GET /api/api-tokens',
      'GET /api/api-tokens/settings',
      'GET /api/ad-accounts',
      'GET /api/ad-groups/sync/status'
    ],
    writeApis: [
      'POST /api/advertising-cost/fetch/facebook',
      'POST /api/advertising-cost/fetch/facebook/by-accounts',
      'POST /api/advertising-cost/fetch/google',
      'POST /api/advertising-cost/fetch/tiktok',
      'POST /api/api-tokens/:id/validate',
      'POST /api/api-tokens/:id/rotate'
    ],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Can AI usage/audit log rieng neu de AI de xuat rotate token.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong hien full token.', 'Rotate/sync dien rong can platform, account, date range va owner xac nhan.']
  },
  {
    scenarioId: 'ADS-002',
    roles: ['ads', 'manager'],
    title: 'Xu ly ROI thap hoac ads dot tien',
    trigger: 'Ads alert high/critical, ROI thap, loi nhuan am, spend tang dot bien.',
    goal: 'Chi ra nhom can giam/tat/test lai va bang chung du lieu.',
    readApis: [
      'GET /api/ads-alerts',
      'GET /api/ads-alerts/summary',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/advertising-cost/stats/by-adgroup?adGroupId=...',
      'GET /api/ad-report/cost-per-order',
      'GET /api/financial-control/dashboard'
    ],
    writeApis: ['POST /api/ai-marketing/plans/generate', 'PATCH /api/ai-marketing/plans/:planId/items/:itemId/approve', 'POST /api/ai-marketing/plans/:planId/apply', 'POST /api/emergency-actions/bulk-sync', 'PATCH /api/emergency-actions/:taskId/toggle', 'POST /api/finance/ad-groups/:id/manual-scale'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Chua co Creative Library va creative-level profit attribution.', 'Unified pause/kill campaign van can mo rong theo tung platform.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong pause/apply budget that khi chua duyet.', 'Neu cashflow cang, khuyen nghi scale phai bi chan.']
  },
  {
    scenarioId: 'ADS-003',
    roles: ['ads', 'manager'],
    title: 'De xuat scale nhom quang cao tot',
    trigger: 'Ad group ROI cao, loi nhuan tot, don hang on dinh va cashflow cho phep.',
    goal: 'Tim nhom nen scale, muc scale de xuat va rui ro can theo doi.',
    readApis: [
      'GET /api/ad-group-daily-report/optimal-spend',
      'GET /api/ad-groups/recommendations',
      'GET /api/financial-control/optimal-ads',
      'GET /api/budget-allocation/preview',
      'GET /api/ai-marketing/overview',
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/ai-marketing/plans',
      'GET /api/funds/ads',
      'GET /api/products/:id/media'
    ],
    writeApis: ['POST /api/ai-marketing/plans/generate', 'PATCH /api/ai-marketing/plans/:planId/items/:itemId/approve', 'POST /api/ai-marketing/plans/:planId/apply', 'POST /api/ad-groups/recommendations/apply', 'POST /api/budget-allocation/auto', 'POST /api/finance/ad-groups/:id/manual-scale'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Can media readiness score neu scale phu thuoc creative.', 'Creative Library chua co performance theo asset.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Scale theo cap ngay va cashflow.', 'Neu media/san pham/gia thieu thi khong scale.']
  },
  {
    scenarioId: 'ADS-004',
    roles: ['ads'],
    title: 'Tao/import/discover ad group',
    trigger: 'Tai khoan co nhom moi, can map fanpage/san pham/nhan vien.',
    goal: 'Dua ad group vao ERP de tinh ROI, chi phi, don hang va KPI.',
    readApis: [
      'GET /api/ad-accounts',
      'GET /api/ad-groups/discover/all-active',
      'GET /api/ad-groups/discover/:adAccountId',
      'GET /api/ad-groups/validate/adgroupid/:adGroupId',
      'GET /api/fanpages',
      'GET /api/products'
    ],
    writeApis: ['POST /api/ad-groups', 'POST /api/ad-groups/import', 'POST /api/ad-groups/sync/:adAccountId', 'PATCH /api/ad-groups/:id', 'POST /api/employee-ads-kpi/assign'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Can rule bat buoc mapping neu adGroupId/fanpageId/productId thieu.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong tao trung adGroupId.', 'Map sai product/fanpage se lam sai ROI va auto-reply.']
  },
  {
    scenarioId: 'ADS-005',
    roles: ['ads', 'manager'],
    title: 'Kiem tra creative/media truoc khi scale',
    trigger: 'Nhom ads tot nhung can them anh/video/noi dung truoc khi tang ngan sach.',
    goal: 'Kiem tra asset san pham/fanpage va de xuat viec media can lam.',
    readApis: [
      'GET /api/media',
      'GET /api/media/product-report/:productId',
      'GET /api/products/:id/media',
      'GET /api/products/:id/best-images',
      'GET /api/products/variation-images-report',
      'GET /api/ad-groups/:id',
      'GET /api/ai-marketing/creatives',
      'GET /api/ai-marketing/creatives/performance'
    ],
    writeApis: ['POST /api/ai-marketing/creatives', 'PATCH /api/ai-marketing/creatives/:creativeId', 'POST /api/ai-marketing/plans/generate', 'POST /api/products/upload-images', 'PATCH /api/products/:id/fanpage-variation-images'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Provider creative-level spend chua sync truc tiep; hien spend creative duoc uoc tinh tu ad group spend.', 'Can map creativeId vao lead/webhook de attribution manh nhat.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong scale chi vi creative co CTR cao; phai xet lead won/net profit.', 'Upload/sua media can owner san pham duyet.']
  },
  {
    scenarioId: 'ACC-001',
    roles: ['accountant'],
    title: 'Doi soat va thanh toan NCC',
    trigger: 'Den ky doi soat NCC, NCC da thu COD hoac co cong no qua han.',
    goal: 'Tao/kiem tra statement, ghi nhan thanh toan va dong statement khi dung.',
    readApis: [
      'GET /api/supplier-payables/statements',
      'GET /api/supplier-payables/statement/by-supplier',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/supplier-payables/statements/summary/payment',
      'GET /api/test-order2/payment-pending/supplier',
      'GET /api/test-order2/supplier-payment/ops-summary'
    ],
    writeApis: [
      'POST /api/supplier-payables/statements',
      'POST /api/supplier-payables/statements/:id/payments',
      'PATCH /api/supplier-payables/statements/:id/close',
      'PATCH /api/supplier-payables/statements/:id/reopen',
      'POST /api/test-order2/supplier-payment-batch'
    ],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Neu can doi soat ngan hang tu dong thi chua co bank statement import/reconcile.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Can supplierId, period, danh sach don va tong tien.', 'Close statement chi khi so tien/chung tu da khop.']
  },
  {
    scenarioId: 'ACC-002',
    roles: ['accountant'],
    title: 'Thanh toan hoa hong dai ly',
    trigger: 'Den ky thanh toan agent, co don giao thanh cong hoac phat sinh clawback.',
    goal: 'Tinh pending commission, tao batch/statement va ghi nhan thanh toan.',
    readApis: [
      'GET /api/test-order2/agent-payment/ops-summary',
      'GET /api/test-order2/payment-pending/agent',
      'GET /api/test-order2/payment-batches/agent',
      'GET /api/agent-receivables/summary/payment',
      'GET /api/agent-payables/summary/cashflow',
      'GET /api/agent-payables/statements'
    ],
    writeApis: [
      'POST /api/test-order2/agent-payment-batch/atomic',
      'POST /api/agent-payables/statements',
      'POST /api/agent-payables/statements/:id/payments',
      'PATCH /api/agent-payables/statements/:id/close'
    ],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Naming agent-receivables/agent-payables con gay nham lan cho AI.', 'Can policy ro cho hoa hong am/clawback neu chua day du.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Batch lon can nguoi duyet.', 'Neu co hang hoan sau thanh toan, phai noi ro clawback.']
  },
  {
    scenarioId: 'ACC-003',
    roles: ['accountant', 'director'],
    title: 'Quan ly chi phi, luong va cash-out sap den han',
    trigger: 'Can xem committed cash 14 ngay hoac lap ke hoach chi.',
    goal: 'Tong hop chi phi khac, luong, ads spend, loan repayment va tac dong free cash.',
    readApis: [
      'GET /api/other-cost/summary/cashflow?windowDays=14',
      'GET /api/labor-cost1/summary/cashflow',
      'GET /api/advertising-cost/summary/cashflow',
      'GET /api/finance/loan-contracts/summary/cashflow?windowDays=14',
      'GET /api/finance/repayments/upcoming',
      'GET /api/financial-control/dashboard'
    ],
    writeApis: ['POST /api/other-cost', 'POST /api/finance/loans/:id/repayments', 'POST /api/finance/repayments/:id/pay'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Can invoice/payment approval workflow neu muon AI lap lenh chi that.', 'Ads spend can tach cash-out that neu thanh toan theo chu ky.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong ghi nhan da thanh toan neu chua co chung tu.', 'Noi ro chi phi du kien vs da chi.']
  },
  {
    scenarioId: 'ACC-004',
    roles: ['accountant', 'director'],
    title: 'Quan ly khoan vay va lich tra no',
    trigger: 'Sap den han tra no, can vay/tra them hoac director hoi runway.',
    goal: 'Tong hop du no, lich tra, tac dong dong tien va de xuat uu tien.',
    readApis: [
      'GET /api/finance/loans',
      'GET /api/finance/loans/summary',
      'GET /api/finance/repayments/upcoming',
      'GET /api/loan-management/dashboard',
      'GET /api/loan-management/loans/:id/payment-options',
      'GET /api/financial-control/forecast'
    ],
    writeApis: ['POST /api/finance/loans', 'PATCH /api/finance/loans/:id', 'POST /api/finance/loans/:id/repayments', 'POST /api/loan-management/loans/:id/pay'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Can policy uu tien tra no neu co nhieu lender/lai suat khac nhau.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Thanh toan no can amountPrincipal/amountInterest chinh xac.', 'Khong tu tao khoan vay neu chua co hop dong.']
  },
  {
    scenarioId: 'ACC-005',
    roles: ['accountant', 'director'],
    title: 'Doi soat bao cao loi nhuan san pham/ads',
    trigger: 'Loi nhuan lech, san pham thua lo, can xem nguyen nhan.',
    goal: 'Doi chieu don, chi phi ads, gia NCC, hoa hong va chi phi khac.',
    readApis: [
      'GET /api/test-order2/daily-profit-report',
      'GET /api/test-order2/product-profit-report',
      'GET /api/test-order2/product-profit-report',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/supplier-quotes/effective',
      'GET /api/quotes/product/:productId'
    ],
    writeApis: ['POST /api/test-order2/:id/recalculate-profits', 'POST /api/test-order2/recalculate-all-profits', 'POST /api/test-order2/:id/recalculate-quotes'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Can endpoint audit diff chi tiet neu AI muon chi ra field nao lam lech loi nhuan.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Recalculate hang loat can gio thap diem va backup.', 'Khong sua gia nguon neu chua duyet.']
  },
  {
    scenarioId: 'ACC-006',
    roles: ['accountant', 'director'],
    title: 'Kiem tra chung tu thanh toan',
    trigger: 'CFO can biet payment nao thieu chung tu, reference hoac bang chung.',
    goal: 'Tim cac khoan NCC/agent/luong/chi phi/no vay thieu chung tu truoc khi xac nhan da thanh toan.',
    readApis: [
      'GET /api/media',
      'GET /api/supplier-payables/statements/:id',
      'GET /api/agent-payables/statements',
      'GET /api/labor-cost1/statements/:id',
      'GET /api/other-cost',
      'GET /api/loan-management/payments'
    ],
    writeApis: ['POST /api/media/upload', 'PATCH /api/other-cost/:id'],
    apiSufficiency: 'partial',
    missingDataOrApi: [
      'Chua co document service chuan voi entityType/entityId/OCR/hash/required-by-status.',
      'Nhieu payment chi co documents string array, kho audit va doi soat chung tu.'
    ],
    executionMode: 'manual_handoff',
    approvalRequired: true,
    guardrails: ['AI khong xac nhan da thanh toan neu thieu chung tu bat buoc.', 'Upload/update chung tu can gan dung entity va nguoi duyet.']
  },
  {
    scenarioId: 'ACC-007',
    roles: ['accountant', 'director'],
    title: 'Soat double payment, overpay va reopen bat thuong',
    trigger: 'CFO nghi co tra trung, tra vuot, statement bi reopen hoac batch bat thuong.',
    goal: 'Phat hien giao dich rui ro cao va tao danh sach can kiem tra thu cong.',
    readApis: [
      'GET /api/test-order2/payment-batches/supplier',
      'GET /api/test-order2/payment-batches/agent',
      'GET /api/supplier-payables/statements',
      'GET /api/agent-payables/statements',
      'GET /api/labor-cost1/statements',
      'GET /api/loan-management/payments'
    ],
    writeApis: [],
    apiSufficiency: 'partial',
    missingDataOrApi: [
      'Chua co immutable audit ledger/event log tap trung cho tat ca payment.',
      'Payment nam rai rac trong statement/order/loan nen AI chi soat duoc theo rule tam thoi.'
    ],
    executionMode: 'read_only',
    approvalRequired: false,
    guardrails: ['AI chi canh bao, khong tu xoa/sua payment.', 'Neu can rollback phai di qua director va audit log.']
  },
  {
    scenarioId: 'SUP-001',
    roles: ['supplier'],
    title: 'Xem don can san xuat/giao hang',
    trigger: 'NCC mo ERP de xem viec can lam trong ngay.',
    goal: 'Liet ke don trong pham vi supplier can xu ly, thieu tracking hoac tre trang thai.',
    readApis: [
      'GET /api/test-order2',
      'GET /api/order-status',
      'GET /api/production-status',
      'GET /api/delivery-status'
    ],
    writeApis: ['PATCH /api/test-order2/:id', 'PATCH /api/test-order2/:id/delivery-status'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Can dam bao RBAC/service filter supplierId theo current supplier; AI khong duoc dua du lieu supplier khac.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Supplier chi xem/sua don cua minh.', 'Khong cho supplier tao/xoa don hoac doi supplier assignment.']
  },
  {
    scenarioId: 'SUP-002',
    roles: ['supplier'],
    title: 'Cap nhat tracking va trang thai giao hang',
    trigger: 'Don da co ma van don, da giao, dang giao hoac bi hoan.',
    goal: 'Cap nhat trackingNumber/deliveryStatus/productionStatus de sale va ke toan theo doi.',
    readApis: ['GET /api/test-order2/:id', 'GET /api/delivery-status', 'GET /api/production-status'],
    writeApis: ['PATCH /api/test-order2/:id', 'PATCH /api/test-order2/:id/delivery-status'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Chua co carrier tracking integration de verify ma van don tu dong.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong cap nhat thanh giao thanh cong/hoan neu chua co bang chung.', 'Tracking sai lam sai doi soat COD.']
  },
  {
    scenarioId: 'SUP-003',
    roles: ['supplier'],
    title: 'Doi soat COD va statement NCC',
    trigger: 'NCC muon xem ky doi soat, so tien can chuyen/da chuyen.',
    goal: 'Giai thich statement, balance, payment va don lien quan.',
    readApis: [
      'GET /api/supplier-payables/statement/by-supplier',
      'GET /api/supplier-payables/statements',
      'GET /api/supplier-payables/statements/:id',
      'GET /api/supplier-payables/statements/:id/pdf',
      'GET /api/test-order2/payment-pending/supplier'
    ],
    writeApis: [],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Supplier self-service scope can filter current supplier; payment recording van nen do ke toan lam.'],
    executionMode: 'read_only',
    approvalRequired: false,
    guardrails: ['Khong cho supplier ghi nhan payment thay ke toan.', 'Khong hien statement cua supplier khac.']
  },
  {
    scenarioId: 'SUP-004',
    roles: ['supplier'],
    title: 'Xu ly hang hoan/khieu nai van hanh',
    trigger: 'Don bi hoan, khach khieu nai, can cap nhat ly do va huong xu ly.',
    goal: 'Tong hop don hoan theo supplier va tao viec cho ops/sale neu can.',
    readApis: [
      'GET /api/return-report/ad-group',
      'GET /api/return-report/product',
      'GET /api/returns/:id',
      'GET /api/test-order2',
      'GET /api/customers'
    ],
    writeApis: ['POST /api/returns', 'PATCH /api/test-order2/:id', 'MISSING POST /api/ops-actions'],
    apiSufficiency: 'partial',
    missingDataOrApi: ['Can verify actual return-request routes/fields cho supplier scope; return workflow chua nam trong snapshot AI hien tai.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong quy trach nhiem/hoan tien neu chua co bang chung.', 'Khieu nai tai chinh can manager/ke toan xu ly.']
  },
  {
    scenarioId: 'CFO-002',
    roles: ['director', 'accountant'],
    title: 'Ads budget cashflow gate',
    trigger: 'Director/CFO hoi co du tien tang ads them moi ngay hay khong.',
    goal: 'Danh gia scale ads qua free cash, forecast, committed cash va attribution quality truoc khi tao de xuat cho duyet.',
    readApis: [
      'GET /api/finance/ads-budget-cashflow-gate?proposedIncrease=...',
      'GET /api/financial-control/dashboard',
      'GET /api/financial-control/forecast',
      'GET /api/budget-allocation/preview',
      'GET /api/ads/ad-groups/profit-classification?days=7',
      'GET /api/advertising-cost/sync/health'
    ],
    writeApis: ['POST /api/ai-actions/draft', 'POST /api/ai-actions/request-approval'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Endpoint finance gate V2 duoc map tam vao Financial Control va Budget Allocation cho den khi API rieng duoc tach.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong de xuat scale neu free cash/forecast/attribution khong dat rule.', 'Moi tang ngan sach that phai tao draft action va approval request.']
  },
  {
    scenarioId: 'MKT-004',
    roles: ['director', 'manager', 'ads'],
    title: 'Marketing funnel health',
    trigger: 'Lead tang nhung don khong tang, sale funnel bi nghen hoac can tim bottleneck.',
    goal: 'Doc spend, lead, order, payment, funnel rate va sales SLA de tim nguyen nhan kha nghi.',
    readApis: [
      'GET /api/marketing/funnel-summary?days=7',
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/test-order2',
      'GET /api/ad-report/cost-per-order'
    ],
    writeApis: [],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Lead module rieng chua tach; hien dung ai-marketing, conversation va pending-order signal.'],
    executionMode: 'read_only',
    approvalRequired: false,
    guardrails: ['Khong ket luan ads loi neu sale follow-up SLA dang vi pham nghiem trong.', 'Chi neu bottleneck theo source da load.']
  },
  {
    scenarioId: 'MKT-005',
    roles: ['ads', 'manager'],
    title: 'Creative fatigue review',
    trigger: 'Mau quang cao bi met, CTR giam, CPC/CPL tang hoac can thay content.',
    goal: 'Danh gia creative fatigue bang frequency, CTR, CPC, CPL, conversion va spend/order trend.',
    readApis: [
      'GET /api/ads/creative-fatigue?days=14',
      'GET /api/ai-marketing/creatives/performance',
      'GET /api/advertising-cost/stats/by-adgroup?adGroupId=...',
      'GET /api/ad-group-profit-report/performance'
    ],
    writeApis: ['POST /api/ai-marketing/creatives', 'POST /api/ai-marketing/plans/generate'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Creative-level provider spend van phu thuoc ai-marketing creative performance va mapping ad group.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong tat creative chi vi CTR thap neu loi nhuan/funnel chua du.', 'Tao plan/test variant truoc khi thay doi lon.']
  },
  {
    scenarioId: 'MKT-006',
    roles: ['director', 'manager', 'ads'],
    title: 'Offer performance review',
    trigger: 'Lead co nhung sale khong chot, nghi offer/khuyen mai/san pham yeu.',
    goal: 'Doi chieu lead, order, product, quote, gross margin va offer signal de xem offer co can doi hay khong.',
    readApis: [
      'GET /api/marketing/offer-performance?days=30',
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/products',
      'GET /api/quotes',
      'GET /api/test-order2'
    ],
    writeApis: ['POST /api/ai-actions/draft'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Offer entity rieng chua co; hien suy tu product, quote va funnel signal.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Khong doi gia/khuyen mai that neu chua qua approval.', 'Neu margin thieu thi chi de xuat kiem tra offer, khong ket luan chac.']
  },
  {
    scenarioId: 'OPS-003',
    roles: ['manager', 'sales'],
    title: 'Create sales SLA tasks from AI issue',
    trigger: 'Quan ly yeu cau tao task cho sale xu ly lead qua han/chua goi.',
    goal: 'Tao danh sach task nhap tu lead/pending conversation qua SLA va cho duyet truoc khi giao viec.',
    readApis: [
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/pending-orders',
      'GET /api/tasks/ai-followup-status',
      'GET /api/ops-actions/suggestions'
    ],
    writeApis: ['POST /api/tasks/create-from-ai-issue', 'POST /api/tasks/bulk-create-from-ai-report'],
    apiSufficiency: 'sufficient',
    missingDataOrApi: ['Task API V2 duoc map tam vao ops-actions approval-only plan trong he thong hien tai.'],
    executionMode: 'approval_required',
    approvalRequired: true,
    guardrails: ['Chi tao task nhap/cho duyet, khong noi da giao viec neu chua co executor.', 'Task phai co ownerRole, dueAt va sourceIssueId.']
  }
];

export const AI_TOKEN_MANAGEMENT_GUIDE = {
  purpose: 'Quan ly AI API token qua OpenAI Config, tach rieng voi token ads/social trong Api Token.',
  aiTokenRoutes: [
    { route: '/openai-configs', permission: 'openai-configs', meaning: 'Tao, sua, test va dat config OpenAI mac dinh cho AI/chatbot.' },
    { route: '/api-tokens', permission: 'api-tokens', meaning: 'Quan ly Meta/Google/TikTok token dung cho sync ads va fanpage.' },
    { route: '/ads-settings', permission: 'api-tokens', meaning: 'Cau hinh credential sync ads theo platform.' }
  ],
  lifecycle: [
    'Tao config OpenAI voi ten, model, API key, system prompt va scope.',
    'Test dinh dang key truoc khi luu.',
    'Dat mot config global active/default de AI Operator co the su dung.',
    'Khi nghi token lo hoac het han, cap nhat key moi va vo hieu hoa config cu.',
    'Theo doi loi AI fallback trong log de phat hien key/model/quota co van de.'
  ],
  guardrails: [
    'Khong luu hoac hien thi full API key trong giao dien danh sach.',
    'Khong dua API key/token vao prompt gui sang AI.',
    'Moi thay doi key production can ghi ro owner, ly do va thoi diem.'
  ]
};

export const AI_ASSISTANT_GUARDRAILS = [
  'Mac dinh AI Operator chi doc du lieu va de xuat; khong khang dinh da thuc thi hanh dong.',
  'Moi thao tac tao batch thanh toan, rotate token, apply ads budget, rut owner, tao user hoac xoa du lieu phai co xac nhan ro.',
  'Cau tra loi tai chinh phai noi ro neu du lieu thieu module hoac chi la proxy.',
  'Cau tra loi ads phai xet cashflow/survival truoc khi de xuat scale.',
  'AI phai nhac module/endpoint nguon khi dua khuyen nghi quan trong.',
  'Chuan 9+: moi cau tra loi dieu hanh phai co ket luan, du lieu da doc, phan tich, viec can lam, rui ro/thieu du lieu va phan can duyet.',
  'Neu assistantQuality score thap hoac co notLoadedReadApis, AI phai ha muc do chac chan va chi ro can bo sung du lieu nao.'
];

export const AI_OPERATOR_QUESTION_PLAYBOOK: QuestionPlaybookGroup[] = [
  {
    groupId: 'daily_overview',
    title: 'Tong quan dau ngay',
    questions: [
      'Hom nay cong ty co van de gi lon?',
      'Hom nay co viec gi can toi xu ly?',
      'Hom nay co rui ro gi can chu y?',
      'Bo phan nao dang co van de nhat?',
      'Viec nao dang nong nhat?',
      'Co viec gi can toi duyet khong?',
      'So voi hom qua tinh hinh tot len hay xau di?'
    ],
    defaultIntents: ['director_daily_overview', 'business_risk_ranking', 'decision_waiting_approval', 'company_kpi_scorecard'],
    primaryReadApis: [
      'GET /api/financial-control/dashboard',
      'GET /api/financial-control/forecast',
      'GET /api/financial-control/actions',
      'GET /api/ads-alerts',
      'GET /api/test-order2',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/agent-payables/summary/cashflow',
      'GET /api/ops-actions/suggestions'
    ],
    analysisSteps: [
      'Xep hang finance, ads, order, receivable, token/sync va ops theo muc do anh huong.',
      'Tinh trang thai cong ty tu free cash, forecast risk, ads loss/alert, don tre va viec qua han.',
      'Chi dua top 3-7 van de, moi van de phai co owner/module va viec ke tiep.'
    ],
    responseRules: [
      'Mo dau bang ket luan: on dinh, can theo doi, rui ro hoac nguy cap.',
      'Neu hoi can xu ly/duyet thi dua danh sach viec theo muc do uu tien va noi ro viec nao can approval.',
      'Neu so sanh hom qua, neu thieu baseline thi noi ro chua co snapshot hom qua thay vi doan.'
    ],
    guardrails: ['Khong noi da xu ly viec nao.', 'Moi hanh dong tai chinh/ads/payment chi la de xuat cho duyet.'],
    dataGaps: ['Chua co kho luu daily executive snapshot rieng de so sanh xu huong hom qua neu khong load duoc order/finance history.']
  },
  {
    groupId: 'revenue_profit',
    title: 'Doanh thu va loi nhuan',
    questions: [
      'Hom qua doanh thu bao nhieu?',
      'Hom nay doanh thu dang the nao?',
      'Thang nay doanh thu dat bao nhieu phan tram muc tieu?',
      'Loi nhuan hom qua/thang nay bao nhieu?',
      'San pham nao dang lai nhat?',
      'San pham nao ban nhieu nhung lai thap?',
      'San pham nao dang lo?',
      'Kenh nao mang lai loi nhuan tot nhat?'
    ],
    defaultIntents: ['company_kpi_scorecard', 'product_profit_leaderboard', 'channel_mix_review', 'unit_economics'],
    primaryReadApis: [
      'GET /api/test-order2/daily-profit-report',
      'GET /api/test-order2/product-profit-report',
      'GET /api/ads/ad-groups/profit-classification?days=7',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/ai-marketing/overview'
    ],
    analysisSteps: [
      'Uu tien don hoan tat de tinh revenue/profit; tach doanh thu ghi nhan voi tien thuc thu.',
      'Tong hop theo ngay, thang-to-date, san pham, dai ly/fanpage/ad group neu co mapping.',
      'Neu hoi phan tram muc tieu, can co target trong plan/config; khong co target thi chi tra actual va noi thieu target.'
    ],
    responseRules: [
      'Cau hoi so lieu phai tra con so dau tien, sau do moi giai thich nguon tinh.',
      'San pham/kenh phai co bang top va ly do: revenue, net profit, margin, orders.'
    ],
    guardrails: ['Khong tron loi nhuan sau ads voi gross profit.', 'Neu order chua final thi khong tinh vao loi nhuan chac chan.'],
    dataGaps: ['Chua co endpoint target doanh thu thang rieng; can plan/config muc tieu neu muon tra phan tram dat muc tieu.']
  },
  {
    groupId: 'ads_marketing',
    title: 'Quang cao va marketing',
    questions: [
      'Hom nay ads co van de gi khong?',
      'Tong chi quang cao hom qua bao nhieu?',
      'Nhom quang cao nao lai nhat?',
      'Nhom quang cao nao dang lo?',
      'Camp nao dang dot tien?',
      'Camp nao co spend nhung khong ra don?',
      'Co nen tang ngan sach nhom nao khong?',
      'Co nhom nao nen tat khong?',
      'Facebook hay Google hieu qua hon?',
      'Lead tang nhung don khong tang la do dau?',
      'Mau quang cao nao dang yeu di?'
    ],
    defaultIntents: ['ads', 'ad_group_profit_classification', 'ads_scale_readiness', 'ads_kill_or_pause_recommendation', 'marketing_funnel_health', 'creative_fatigue_review', 'channel_mix_review'],
    primaryReadApis: [
      'GET /api/ads-alerts',
      'GET /api/ads/ad-groups/profit-classification?days=7',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/ad-group-profit-report/optimal-spend',
      'GET /api/advertising-cost/stats/summary',
      'GET /api/advertising-cost/stats/by-adgroup',
      'GET /api/advertising-cost/sync/health',
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/ai-marketing/creatives/performance',
      'GET /api/budget-allocation/preview'
    ],
    analysisSteps: [
      'Phan loai nhom/camp theo spend, lead, order, revenue, net profit after ads va data quality.',
      'De xuat scale chi khi profit tot, order du, attribution tot va finance gate khong chan.',
      'Neu lead tang nhung don khong tang, doi chieu funnel voi sales SLA truoc khi ket luan ads loi.'
    ],
    responseRules: [
      'Cau hoi nhom lai/lo phai tra bang: nhom, platform, spend, lead, don, doanh thu, loi nhuan sau ads, trang thai, ly do.',
      'Cau hoi tang/tat ngan sach phai tach ung vien scale, ung vien pause, finance gate va approval.'
    ],
    guardrails: ['Khong apply/pause provider neu chua co approval.', 'Khong scale neu cashflow gate fail.'],
    dataGaps: ['Campaign/creative entity rieng chua day du; mot so cau hoi campaign/creative dang suy tu ad group va ai-marketing mapping.']
  },
  {
    groupId: 'sales_lead',
    title: 'Sale va lead',
    questions: [
      'Hom nay co bao nhieu lead moi?',
      'Lead nao chua xu ly?',
      'Sale nao phan hoi cham?',
      'Sale nao chot tot nhat?',
      'Nguon lead nao chat luong nhat?',
      'Nguon lead nao nhieu nhung khong ra don?',
      'Ty le chot hom nay/thang nay la bao nhieu?',
      'Co khach nao nong can goi ngay khong?',
      'Co lead nao bi bo quen khong?'
    ],
    defaultIntents: ['lead_followup_health', 'sales_sla_violation', 'sales_conversion_by_user', 'lead_quality_by_source', 'marketing_funnel_health'],
    primaryReadApis: [
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/pending-orders',
      'GET /api/test-order2',
      'GET /api/ops-actions/suggestions'
    ],
    analysisSteps: [
      'Lay lead tu ai-marketing, conversations va pending orders neu chua co lead module rieng.',
      'Tinh SLA theo last message/needsHuman/awaiting order; tach lead moi, lead chua xu ly va lead bi bo quen.',
      'Doi chieu lead source voi order va profit de danh gia chat luong.'
    ],
    responseRules: [
      'Neu hoi lead chua xu ly, tra danh sach uu tien goi ngay va ly do.',
      'Neu hoi sale cham/yeu, can neu metric SLA/conversion, khong quy trach nhiem neu source thieu.'
    ],
    guardrails: ['Khong gui tin nhan/goi khach tu dong.', 'Task giao sale phai la draft cho manager duyet.'],
    dataGaps: ['Lead module doc lap chua day du; mot so metric la proxy tu conversation va pending-order.']
  },
  {
    groupId: 'orders_operations',
    title: 'Don hang va van hanh',
    questions: [
      'Hom nay co bao nhieu don moi?',
      'Co bao nhieu don dang tre?',
      'Don nao tre lau nhat?',
      'Don tre vi ly do gi?',
      'Khau nao dang nghen: sale, kho, giao hang hay nha cung cap?',
      'Co don nao nguy co bi huy khong?',
      'Co khach nao dang phan nan khong?',
      'Co don nao thieu tracking khong?'
    ],
    defaultIntents: ['orders', 'late_order_diagnostic', 'fulfillment_bottleneck', 'tracking_issue_check', 'cancel_refund_risk'],
    primaryReadApis: [
      'GET /api/test-order2',
      'GET /api/order-status',
      'GET /api/production-status',
      'GET /api/delivery-status',
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/return-report/product',
      'GET /api/returns/:id'
    ],
    analysisSteps: [
      'Dem don moi/tre/thieu tracking theo orderDate/createdAt va status.',
      'Gan bottleneck theo status: sale, kho/san xuat, giao hang, supplier, payment.',
      'Uu tien don tre lau, khach phan nan, don co risk huy/hoan.'
    ],
    responseRules: ['Tra so luong truoc, sau do top don can xu ly va owner.', 'Neu ly do tre khong co field ro thi noi dang suy tu status.'],
    guardrails: ['Khong doi trang thai/tracking neu chua co bang chung.', 'Tin nhan cho khach can sale/manager duyet.'],
    dataGaps: ['Carrier tracking integration chua day du; ly do tre co the suy tu status neu chua co reason field.']
  },
  {
    groupId: 'cashflow_cfo',
    title: 'Dong tien va CFO',
    questions: [
      'Dong tien hom nay co an toan khong?',
      'Tien tu do con bao nhieu?',
      'Co du tien chi trong 7 ngay toi khong?',
      'Co du tien tang ads khong?',
      'Co nen rut tien chu so huu khong?',
      'Tuan nay can tra khoan nao?',
      'Khoan chi nao dang nguy hiem?',
      'Co khoan nao co rui ro tra trung khong?',
      'Co khoan nao nen hoan chi khong?'
    ],
    defaultIntents: ['finance', 'free_cash_summary', 'cashflow_forecast', 'ads_budget_cashflow_gate', 'owner_withdrawal_readiness', 'double_payment_risk'],
    primaryReadApis: [
      'GET /api/financial-control/dashboard',
      'GET /api/financial-control/forecast',
      'GET /api/finance/available-funds/current',
      'GET /api/finance/cashflow-health',
      'GET /api/finance/repayments/upcoming',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/agent-payables/summary/cashflow',
      'GET /api/budget-allocation/preview'
    ],
    analysisSteps: [
      'Tinh free cash, committed cash, forecast low point, survival floor va upcoming payments.',
      'Phan loai safe/watch/tight/danger.',
      'Chan scale ads/rut owner neu free cash hoac forecast khong dat rule.'
    ],
    responseRules: ['Tra cashStatus va freeCash dau tien.', 'Dua allowedActions va blockedActions thay vi cau tra loi chung chung.'],
    guardrails: ['Rut owner, tra no, batch payment va tang ads luon can approval.', 'Phan biet tien that voi loi nhuan ke toan.'],
    dataGaps: ['Bank reconciliation/payment approval chua dong goi thanh API rieng cho AI.']
  },
  {
    groupId: 'debt',
    title: 'Cong no',
    questions: [
      'Cong no phai thu hien bao nhieu?',
      'Khoan nao can thu ngay?',
      'Khach nao no qua han lau nhat?',
      'Cong no qua han theo nhom tuoi no the nao?',
      'Co khoan nao rui ro mat kha nang thu khong?',
      'Phai tra nha cung cap bao nhieu?',
      'Nha cung cap nao can tra truoc?'
    ],
    defaultIntents: ['receivables', 'receivables_collection_priority', 'supplier_payment_priority'],
    primaryReadApis: [
      'GET /api/supplier-payables/statements',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/agent-payables/summary/cashflow',
      'GET /api/agent-receivables/summary',
      'GET /api/test-order2/payment-pending/supplier',
      'GET /api/test-order2/payment-pending/agent'
    ],
    analysisSteps: ['Tinh open balance, overdue, aging va cashflow impact.', 'Uu tien khoan thu/tra theo due date, so tien va rui ro van hanh.'],
    responseRules: ['Neu hoi can thu ngay, tra top khoan theo qua han/so tien.', 'Neu hoi phai tra, tach NCC va dai ly.'],
    guardrails: ['Khong tao/close statement hoac ghi nhan payment neu chua co approval/chung tu.'],
    dataGaps: ['Aging bucket va collection risk chua co endpoint chuan rieng; hien suy tu dueDate/periodTo/balance.']
  },
  {
    groupId: 'product_inventory',
    title: 'San pham va ton kho',
    questions: [
      'San pham nao ban chay nhat?',
      'San pham nao lai nhat?',
      'San pham nao ton kho nhieu?',
      'San pham nao sap het hang?',
      'San pham nao ban cham?',
      'San pham nao nen day quang cao?',
      'San pham nao nen dung nhap?',
      'San pham nao co ty le hoan/huy cao?'
    ],
    defaultIntents: ['product_profit_leaderboard', 'ads_product_profit_leaderboard', 'unit_economics', 'offer_performance_review'],
    primaryReadApis: [
      'GET /api/products',
      'GET /api/test-order2/product-profit-report',
      'GET /api/return-report/product',
      'GET /api/ads/ad-groups/profit-classification?days=7',
      'GET /api/ai-marketing/overview'
    ],
    analysisSteps: ['Xep hang theo orders, revenue, net profit, margin va return/cancel rate.', 'De xuat day ads khi margin/stock/media/cashflow du.'],
    responseRules: ['Bang san pham phai co orders, revenue, profit, margin va rui ro.', 'Ton kho phai noi ro neu thieu inventory source.'],
    guardrails: ['Khong sua gia/nhap hang neu chua duyet.', 'Khong day ads san pham thieu hang/thieu media/loi nhuan am.'],
    dataGaps: ['Inventory SKU realtime chua nam trong AI snapshot chuan; cau hoi ton kho can them API inventory neu muon chinh xac.']
  },
  {
    groupId: 'people_performance',
    title: 'Nhan su va hieu suat',
    questions: [
      'Nhan vien nao dang ton viec nhieu?',
      'Sale nao dang yeu?',
      'Bo phan nao xu ly cham?',
      'Ai dang co nhieu task qua han?',
      'Ai hoan thanh viec tot nhat hom qua?',
      'Co viec nao chua co nguoi phu trach khong?',
      'Co nhan vien nao can nhac viec khong?'
    ],
    defaultIntents: ['operations', 'sales_sla_violation', 'sales_conversion_by_user', 'lead_followup_health'],
    primaryReadApis: ['GET /api/ops-actions/suggestions', 'GET /api/employee-ads-kpi', 'GET /api/chat-messages/conversations/list/all', 'GET /api/test-order2'],
    analysisSteps: ['Doi chieu workload/task/SLA/KPI theo role.', 'Uu tien nhan vien co critical KPI, lead tre, task qua han.'],
    responseRules: ['Khong xep hang con nguoi neu metric thieu; noi ro metric dang dung.', 'De xuat nhac viec hoac coaching, khong ket luan ky luat.'],
    guardrails: ['Khong tao task/giao viec that neu manager chua duyet.', 'Khong hien thong tin ngoai pham vi quyen.'],
    dataGaps: ['Task/timesheet V2 dang map tam qua ops-actions; can task module chuan de do backlog nhan su day du.']
  },
  {
    groupId: 'customer',
    title: 'Khach hang',
    questions: [
      'Khach hang nao mua nhieu nhat?',
      'Khach hang nao co gia tri cao nhat?',
      'Khach nao lau roi chua mua lai?',
      'Khach nao dang khieu nai?',
      'Khach nao can cham soc lai?',
      'Nguon khach nao mang lai loi nhuan tot nhat?',
      'Tep khach nao nen remarketing?'
    ],
    defaultIntents: ['sales', 'lead_quality_by_source', 'marketing_funnel_health'],
    primaryReadApis: ['GET /api/customers', 'GET /api/test-order2', 'GET /api/chat-messages/conversations/list/all', 'GET /api/ai-marketing/leads/funnel'],
    analysisSteps: ['Tinh LTV/revenue/profit va recency tu orders/customers.', 'Gan khieu nai/cham soc lai tu conversations/returns neu co.'],
    responseRules: ['Neu khong co CRM fields, tra theo du lieu order/conversation va neu ro han che.', 'Remarketing can dua tren source, recency, profit va consent/channel.'],
    guardrails: ['Khong gui remarketing tu dong.', 'Khong hien du lieu ca nhan vuot quyen.'],
    dataGaps: ['CRM segmentation/consent chua ro; remarketing list nen la de xuat cho duyet.']
  },
  {
    groupId: 'system_integration',
    title: 'He thong va tich hop',
    questions: [
      'Token Facebook co loi khong?',
      'Fanpage nao mat ket noi?',
      'Sync quang cao co loi khong?',
      'Webhook co loi khong?',
      'Co du lieu nao chua dong bo khong?',
      'OpenAI API co hoat dong binh thuong khong?',
      'Co loi he thong nao anh huong van hanh khong?'
    ],
    defaultIntents: ['token_health_check', 'fanpage_permission_check', 'platform_sync_health', 'openai_config_health', 'webhook_failure_diagnostic'],
    primaryReadApis: [
      'GET /api/api-tokens',
      'GET /api/api-tokens/settings',
      'GET /api/fanpages',
      'GET /api/advertising-cost/sync/health',
      'GET /api/openai-configs',
      'GET /api/chat-messages/events'
    ],
    analysisSteps: ['Tong hop token expired/failing, fanpage disconnected, sync stale/fail va webhook error.', 'Danh gia tac dong den ads attribution, chatbot va don hang.'],
    responseRules: ['Tra loi co/khong theo tung platform/source.', 'Khong hien full token/API key; chi hien masked id/name/status.'],
    guardrails: ['Validate/rotate/sync dien rong can nguoi duyet.', 'Khong dua secret vao prompt/cau tra loi.'],
    dataGaps: ['Webhook health chua co endpoint health rieng; hien suy tu events/log neu co.']
  },
  {
    groupId: 'approval',
    title: 'Quyet dinh can duyet',
    questions: [
      'Co viec gi dang cho toi duyet?',
      'Co ke hoach ads nao cho duyet?',
      'Co khoan chi nao cho duyet?',
      'Co don/hop dong nao can toi quyet khong?',
      'Co task nao can nang cap xu ly khong?',
      'Co de xuat nao AI da tao nhung chua thuc hien khong?'
    ],
    defaultIntents: ['decision_waiting_approval'],
    primaryReadApis: [
      'GET /api/financial-control/actions',
      'GET /api/ai-marketing/plans',
      'GET /api/ai-marketing/actions/evaluations',
      'GET /api/ops-actions/suggestions',
      'GET /api/supplier-payables/statements',
      'GET /api/test-order2'
    ],
    analysisSteps: ['Lay moi suggestion/plan/action co approvalRequired hoac waiting status.', 'Sap xep theo urgency, amount, risk va expiry.'],
    responseRules: ['Tra bang: viec, module, ly do, tac dong, nguoi de xuat, deadline, can phe duyet gi.', 'Neu khong co approval store chuan, noi ro dang tong hop tu suggestion/plan hien co.'],
    guardrails: ['Khong noi approved/executed neu executor chua xac nhan.', 'Approval phai luu before/after state va audit.'],
    dataGaps: ['Approval queue tap trung chua tach rieng; dang gom tu financial actions, ai-marketing plans va ops suggestions.']
  },
  {
    groupId: 'root_cause_analysis',
    title: 'Phan tich vi sao',
    questions: [
      'Vi sao doanh thu tang nhung loi nhuan khong tang?',
      'Vi sao lead tang nhung don khong tang?',
      'Vi sao ads ton tien nhung khong ra don?',
      'Vi sao san pham ban nhieu nhung lai thap?',
      'Vi sao dong tien xau du doanh thu tot?'
    ],
    defaultIntents: ['root_cause_analysis'],
    primaryReadApis: [
      'GET /api/test-order2/daily-profit-report',
      'GET /api/test-order2/product-profit-report',
      'GET /api/ads/ad-groups/profit-classification?days=7',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/ai-marketing/leads/funnel',
      'GET /api/chat-messages/conversations/list/all',
      'GET /api/financial-control/dashboard'
    ],
    analysisSteps: [
      'Tach metric dau ra bi lech: revenue, net profit, lead, order, cash hoặc margin.',
      'So sanh driver lien quan: volume, price, COGS, ads spend, conversion, refund/cancel, collection timing.',
      'Xep nguyen nhan theo muc dong gop va do tin cay du lieu, khong chi dua mot ly do.'
    ],
    responseRules: [
      'Tra loi theo cau truc: ket luan, 3 nguyen nhan chinh, bang chung, viec can lam, du lieu thieu.',
      'Neu chi co tuong quan thi noi la gia thuyet, khong noi la nguyen nhan chac chan.'
    ],
    guardrails: ['Khong quy trach nhiem ca nhan khi chua co SLA/KPI/audit.', 'Khong de xuat hanh dong chi tien neu chua qua approval.'],
    dataGaps: ['Can baseline hom qua/7 ngay/30 ngay va mapping ads-lead-order-product de ket luan root cause manh.']
  },
  {
    groupId: 'anomaly_detection_daily',
    title: 'Phat hien bat thuong',
    questions: [
      'Hom nay co gi bat thuong khong?',
      'Chi so nao dot ngot xau di?',
      'Khoan chi nao tang bat thuong?',
      'San pham nao giam manh?',
      'Bo phan nao co hieu suat bat thuong?'
    ],
    defaultIntents: ['anomaly_detection_daily'],
    primaryReadApis: [
      'GET /api/test-order2/daily-profit-report',
      'GET /api/financial-control/dashboard',
      'GET /api/ad-group-profit-report/performance',
      'GET /api/advertising-cost/stats/by-adgroup',
      'GET /api/employee-ads-kpi',
      'GET /api/ads-alerts'
    ],
    analysisSteps: ['So sanh hom nay voi hom qua, trung binh 7 ngay va 30 ngay neu co.', 'Danh dau bat thuong theo % thay doi, so tien anh huong va data freshness.', 'Uu tien bat thuong co anh huong tien/khach/van hanh.'],
    responseRules: ['Neu khong co bat thuong thi noi khong thay tin hieu lon, kem cac nguong da kiem tra.', 'Neu baseline thieu, noi ro chi so nao chua so sanh duoc.'],
    guardrails: ['Khong canh bao qua muc voi mau du lieu qua nho.', 'Khong goi la loi he thong neu chi la du lieu kinh doanh giam.'],
    dataGaps: ['Can daily metric store hoac history API de tinh z-score/threshold chuan.']
  },
  {
    groupId: 'priority_ranking',
    title: 'Xep hang uu tien xu ly',
    questions: [
      'Neu chi xu ly 3 viec hom nay thi la viec gi?',
      'Viec nao anh huong tien nhieu nhat?',
      'Viec nao can can thiep truoc?',
      'Van de nao co thiet hai lon nhat?',
      'Toi phai quyet viec nao truoc?'
    ],
    defaultIntents: ['priority_ranking'],
    primaryReadApis: [
      'GET /api/financial-control/actions',
      'GET /api/ads-alerts',
      'GET /api/test-order2',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/ops-actions/suggestions',
      'GET /api/ai-marketing/actions/evaluations'
    ],
    analysisSteps: ['Cham diem impact tien, urgency, customer impact, operational impact va approval need.', 'Lay top 3-5 viec va gan owner/module.', 'Tach viec doc/kiem tra voi viec can duyet.'],
    responseRules: ['Mo dau bang top 3 viec can xu ly ngay.', 'Moi viec phai co ly do, tac dong, owner de nghi va next step.'],
    guardrails: ['Khong noi da giao viec neu chua tao task/audit.', 'Khong tu dong approve.'],
    dataGaps: ['Can task owner/deadline va amount impact de xep hang chinh xac hon.']
  },
  {
    groupId: 'resource_allocation_decision',
    title: 'Quyet dinh tang giam nguon luc',
    questions: [
      'Co nen tang ngan sach ads khong?',
      'Co nen tuyen them sale khong?',
      'Co nen tang nguoi xu ly don khong?',
      'Co nen nhap them hang khong?',
      'Co nen dung nhap san pham nao khong?',
      'Co nen mo them kenh ban khong?'
    ],
    defaultIntents: ['resource_allocation_decision', 'ads_budget_cashflow_gate', 'ads_scale_readiness'],
    primaryReadApis: [
      'GET /api/budget-allocation/preview',
      'GET /api/financial-control/forecast',
      'GET /api/ad-group-profit-report/optimal-spend',
      'GET /api/test-order2/product-profit-report',
      'GET /api/employee-ads-kpi',
      'GET /api/ops-actions/suggestions'
    ],
    analysisSteps: ['Kiem tra demand, capacity, margin va cash gate truoc khi tang nguon luc.', 'Tinh expected impact va downside neu quyet dinh sai.', 'De xuat draft action neu du dieu kien, khong execute.'],
    responseRules: ['Tra allow/hold/block va ly do.', 'Neu tang nguon luc, neu dieu kien dung lai va nguoi duyet.'],
    guardrails: ['Tang ads, tuyen dung, nhap hang va dung san pham deu can phe duyet.', 'Khong scale neu cash gate fail.'],
    dataGaps: ['Capacity nhan su/kho va inventory realtime chua dong goi du trong context AI.']
  },
  {
    groupId: 'owner_accountability',
    title: 'Owner va trach nhiem xu ly',
    questions: [
      'Ai dang xu ly viec cham nhat?',
      'Ai dang de ton viec nhieu?',
      'Bo phan nao dang keo lui ket qua?',
      'Ai can duoc nhac viec?',
      'Ai can duoc dao tao hoac ho tro?'
    ],
    defaultIntents: ['owner_accountability_review', 'operations', 'sales_sla_violation'],
    primaryReadApis: ['GET /api/employee-ads-kpi', 'GET /api/ops-actions/suggestions', 'GET /api/chat-messages/conversations/list/all', 'GET /api/test-order2'],
    analysisSteps: ['Doi chieu SLA, backlog, overdue task, KPI va order/conversation owner.', 'Phan biet canh bao quy trinh voi danh gia con nguoi.', 'De xuat nhac viec/coaching theo metric.'],
    responseRules: ['Chi neu ten/bo phan khi co metric va source.', 'Neu du lieu owner thieu, tra theo bo phan/module thay vi ca nhan.'],
    guardrails: ['Khong ket luan ky luat/thuong phat neu thieu audit.', 'Khong hien du lieu ngoai quyen.'],
    dataGaps: ['Task owner va timesheet chuan chua day du; mot so metric la proxy.']
  },
  {
    groupId: 'channel_profitability',
    title: 'Loi nhuan theo kenh',
    questions: [
      'Kenh nao mang lai loi nhuan tot nhat?',
      'Kenh nao nhieu lead nhung loi nhuan thap?',
      'Kenh nao nen tang dau tu?',
      'Kenh nao nen giam?',
      'Facebook hay Google hieu qua hon theo loi nhuan?'
    ],
    defaultIntents: ['channel_profitability_review', 'channel_mix_review'],
    primaryReadApis: ['GET /api/ad-group-profit-report/performance', 'GET /api/ads/ad-groups/profit-classification?days=7', 'GET /api/ai-marketing/overview', 'GET /api/test-order2'],
    analysisSteps: ['Nhom theo platform/source/fanpage/ad group.', 'Tinh spend, lead, order, revenue, net profit after ads va margin.', 'Danh gia do tin cay attribution truoc khi ket luan.'],
    responseRules: ['Tra bang kenh va chi so loi nhuan.', 'De xuat tang/giam chi la draft qua finance gate.'],
    guardrails: ['Khong so sanh kenh neu attribution/mapping qua yeu ma khong canh bao.', 'Khong apply ngan sach tu dong.'],
    dataGaps: ['Mapping source/platform toi don hang co the chua day du.']
  },
  {
    groupId: 'product_decision',
    title: 'Quyet dinh san pham',
    questions: [
      'San pham nao ban nhieu nhung lai thap?',
      'San pham nao nen day manh?',
      'San pham nao nen dung?',
      'San pham nao it ban nhung lai cao?',
      'San pham nao nen chay remarketing?',
      'San pham nao nen tang gia hoac giam gia?'
    ],
    defaultIntents: ['product_decision_review', 'product_profit_leaderboard', 'offer_performance_review'],
    primaryReadApis: ['GET /api/products', 'GET /api/test-order2/product-profit-report', 'GET /api/return-report/product', 'GET /api/ad-group-profit-report/performance', 'GET /api/ai-marketing/overview'],
    analysisSteps: ['Xep theo revenue, order count, net profit, margin, return/cancel rate, stock/media readiness.', 'Phan loai: day manh, giu, sua offer, dung nhap, dung ads.', 'Neu de xuat gia/nhap hang thi can approval.'],
    responseRules: ['Moi san pham phai co ly do bang chi so.', 'Neu thieu ton kho thi khong ket luan nhap/dung nhap nhu chac chan.'],
    guardrails: ['Khong sua gia, dung nhap hay tang ads san pham neu chua duyet.', 'Khong day san pham loi nhuan am neu chua co ly do chien luoc.'],
    dataGaps: ['Inventory realtime va media readiness chua phai luc nao cung co trong snapshot.']
  },
  {
    groupId: 'customer_value',
    title: 'Gia tri khach hang',
    questions: [
      'Khach hang nao co gia tri cao nhat?',
      'Khach nao can cham soc lai?',
      'Khach nao lau roi chua mua lai?',
      'Khach nao co nguy co roi bo?',
      'Tep khach nao nen remarketing?',
      'Khach nao mua nhieu nhung loi nhuan thap?'
    ],
    defaultIntents: ['customer_value_analysis', 'sales', 'lead_quality_by_source'],
    primaryReadApis: ['GET /api/customers', 'GET /api/test-order2', 'GET /api/chat-messages/conversations/list/all', 'GET /api/ai-marketing/leads/funnel'],
    analysisSteps: ['Tinh revenue, profit, order count, recency va source theo khach/segment.', 'Gan khieu nai/needs-care tu conversation/returns.', 'De xuat cham soc lai/remarketing theo consent va loi nhuan.'],
    responseRules: ['Tra top khach/tep khach kem ly do va next action.', 'Neu thieu CRM fields, noi ro dang dung order/conversation proxy.'],
    guardrails: ['Khong gui tin nhan remarketing tu dong.', 'Khong hien PII vuot quyen.'],
    dataGaps: ['LTV, consent va segment CRM co the chua day du.']
  },
  {
    groupId: 'advanced_cashflow',
    title: 'Dong tien nang cao',
    questions: [
      'Tien dang ket o dau?',
      'Neu tang ads them 1 trieu/ngay thi dong tien co chiu duoc khong?',
      'Neu doanh thu giam 20% thi co du tien khong?',
      'Nen giu tien hay scale?',
      'Khoan nao bat buoc phai tra va khoan nao co the hoan?'
    ],
    defaultIntents: ['advanced_cashflow_scenario', 'ads_budget_cashflow_gate', 'cashflow_forecast'],
    primaryReadApis: [
      'GET /api/financial-control/dashboard',
      'GET /api/financial-control/forecast',
      'GET /api/finance/available-funds/current',
      'GET /api/budget-allocation/preview',
      'GET /api/supplier-payables/summary/cashflow',
      'GET /api/agent-payables/summary/cashflow',
      'GET /api/ad-group-profit-report/optimal-spend'
    ],
    analysisSteps: ['Tach tien mat, cong no phai thu, ton kho, order chua thu, committed cash va upcoming payments.', 'Chay scenario theo ngay va forecast low point.', 'Ket luan allowed/blocked actions.'],
    responseRules: ['Tra cashStatus, freeCash, lowPoint va ket luan duoc/khong duoc.', 'Neu la scenario, liet ke gia dinh tinh toan.'],
    guardrails: ['Khong duyet chi tien/rut owner/tang ads tu dong.', 'Khong tron loi nhuan ke toan voi tien thu duoc.'],
    dataGaps: ['Cash collection timing va bank reconciliation chua chuan hoa trong AI context.']
  },
  {
    groupId: 'business_risk',
    title: 'Xep hang rui ro',
    questions: [
      'Rui ro lon nhat hom nay la gi?',
      'Rui ro nao co the mat tien nhieu nhat?',
      'Rui ro nao can toi quyet ngay?',
      'Rui ro nao lien quan khach hang?',
      'Rui ro nao lien quan he thong?'
    ],
    defaultIntents: ['business_risk_ranking', 'priority_ranking'],
    primaryReadApis: ['GET /api/financial-control/actions', 'GET /api/ads-alerts', 'GET /api/test-order2', 'GET /api/api-tokens', 'GET /api/advertising-cost/sync/health', 'GET /api/ops-actions/suggestions'],
    analysisSteps: ['Cham rui ro theo financial impact, likelihood, urgency va owner.', 'Gom rui ro tai chinh, ads, order, cong no, he thong.', 'De xuat hanh dong giam rui ro va approval neu can.'],
    responseRules: ['Tra top risk kem severity va owner.', 'Neu rui ro la du lieu thieu, tach rieng voi rui ro kinh doanh.'],
    guardrails: ['Khong phong dai rui ro neu source stale.', 'Khong leak secret/token.'],
    dataGaps: ['Can risk registry va incident log de theo doi rui ro lap lai.']
  },
  {
    groupId: 'target_gap',
    title: 'Muc tieu va khoang cach',
    questions: [
      'Thang nay co dat muc tieu khong?',
      'Can bao nhieu don/ngay de dat muc tieu?',
      'Con thieu bao nhieu doanh thu?',
      'Con thieu bao nhieu lead?',
      'Bo phan nao dang keo lui muc tieu?'
    ],
    defaultIntents: ['target_gap_analysis', 'company_kpi_scorecard'],
    primaryReadApis: ['GET /api/test-order2/daily-profit-report', 'GET /api/test-order2/product-profit-report', 'GET /api/financial-control/dashboard', 'GET /api/ai-marketing/overview'],
    analysisSteps: ['Lay actual month-to-date va target neu co.', 'Tinh gap, required daily run-rate va ngay con lai.', 'Chi ra driver can cai thien: ads, sale, order, product, cash.'],
    responseRules: ['Neu khong co target, khong duoc noi dat/chua dat; chi tra actual va noi thieu target.', 'Can neu cong thuc don/ngay hoặc revenue/ngay.'],
    guardrails: ['Khong dat target thay user.', 'Khong dua muc tieu moi neu khong co approval/plan.'],
    dataGaps: ['Can target config theo thang/bo phan/san pham de tra chinh xac.']
  },
  {
    groupId: 'period_comparison',
    title: 'So sanh ky',
    questions: [
      'Tuan nay so voi tuan truoc tot len hay xau di?',
      'Thang nay so voi thang truoc the nao?',
      'Hom nay so voi hom qua the nao?',
      'Doanh thu/loi nhuan/ads/sale dang tot len hay kem di?',
      'Cung ky nam ngoai the nao?'
    ],
    defaultIntents: ['period_comparison', 'company_kpi_scorecard'],
    primaryReadApis: ['GET /api/test-order2/daily-profit-report', 'GET /api/ad-group-profit-report/performance', 'GET /api/financial-control/dashboard', 'GET /api/ai-marketing/overview'],
    analysisSteps: ['Chon hai ky so sanh dung theo cau hoi.', 'Tinh delta absolute va percent cho revenue, profit, spend, orders, leads, conversion.', 'Giai thich driver chinh va do tin cay.'],
    responseRules: ['Tra tot len/xau di theo tung metric, khong gop chung neu metric trai chieu.', 'Neu thieu history, noi ro khong du baseline.'],
    guardrails: ['Khong so sanh cung ky neu data retention khong co.', 'Khong ket luan xu huong tu mot mau qua nho.'],
    dataGaps: ['Can history API theo ngay/tuan/thang de so sanh day du.']
  },
  {
    groupId: 'scenario_analysis',
    title: 'Phan tich neu-thi',
    questions: [
      'Neu giam gia 10% thi loi nhuan co tot hon khong?',
      'Neu tang gia thi don co giam bao nhieu moi hoa von?',
      'Neu tuyen them sale thi can bao nhieu lead de hoa von?',
      'Neu dung san pham A thi anh huong doanh thu the nao?',
      'Neu nhap them hang thi bao lau thu hoi von?'
    ],
    defaultIntents: ['scenario_analysis', 'advanced_cashflow_scenario', 'resource_allocation_decision'],
    primaryReadApis: ['GET /api/test-order2/product-profit-report', 'GET /api/financial-control/forecast', 'GET /api/budget-allocation/preview', 'GET /api/employee-ads-kpi', 'GET /api/products'],
    analysisSteps: ['Xac dinh bien dau vao va gia dinh.', 'Tinh best/base/worst case neu du du lieu.', 'Neu thieu elasticity/capacity, tra khung cong thuc va so can bo sung.'],
    responseRules: ['Luon tach so lieu that voi gia dinh.', 'Khong de xuat execute neu chi la scenario.'],
    guardrails: ['Khong coi scenario la forecast chac chan.', 'Hanh dong gia/ads/nhap hang can duyet.'],
    dataGaps: ['Can elasticity, capacity va inventory/payment timing de tinh scenario chuan.']
  },
  {
    groupId: 'ai_recommendation_review',
    title: 'Hau kiem de xuat AI',
    questions: [
      'Sau khi chinh ads hom qua ket qua the nao?',
      'Hom qua AI de xuat gi va da lam duoc gi?',
      'De xuat AI nao dung, de xuat nao sai?',
      'Playbook nao can sua?',
      'Co de xuat AI nao chua thuc hien khong?'
    ],
    defaultIntents: ['ai_recommendation_review', 'decision_waiting_approval'],
    primaryReadApis: ['GET /api/ai-marketing/actions/evaluations', 'GET /api/ai-marketing/plans', 'GET /api/financial-control/actions', 'GET /api/ops-actions/suggestions', 'GET /api/ad-group-profit-report/performance'],
    analysisSteps: ['Lay de xuat AI, approval/execution status va metric before/after.', 'Phan loai da lam, chua lam, dang cho duyet, that bai, can sua playbook.', 'Chi ket luan hieu qua khi co before/after va audit.'],
    responseRules: ['Khong noi da thuc hien neu khong co executor/audit log.', 'Neu thieu log, tra danh sach de xuat va noi chua xac nhan execution.'],
    guardrails: ['Khong tu dong sua playbook/ads theo hau kiem.', 'Moi dieu chinh tiep theo can approval.'],
    dataGaps: ['Can audit log chuan luu recommendationId, approvalId, executor result va before/after metrics.']
  },
  {
    groupId: 'concise_role_briefing',
    title: 'Tom tat ngan theo vai tro',
    questions: [
      'Tom tat 5 dong cho giam doc hom nay.',
      'Chi noi 3 viec nghiem trong nhat.',
      'Ban danh cho quan ly sale hom nay.',
      'Ban danh cho ke toan hom nay.',
      'Noi ngan gon viec can toi quyet.'
    ],
    defaultIntents: ['concise_role_briefing'],
    primaryReadApis: ['GET /api/financial-control/dashboard', 'GET /api/ads-alerts', 'GET /api/test-order2', 'GET /api/ops-actions/suggestions', 'GET /api/api-tokens'],
    analysisSteps: ['Loc theo role va chi giu top issue/action.', 'Bo chi tiet phu nhung giu so lieu chinh, owner va approval need.', 'Neu co canh bao du lieu quan trong thi van phai noi.'],
    responseRules: ['Toi da 5 dong neu user yeu cau ngan.', 'Moi dong co ket luan hoac hanh dong, khong viet giai thich dai.'],
    guardrails: ['Khong bo qua risk critical de lam cau tra loi dep.', 'Khong noi da approve/execute neu chua co log.'],
    dataGaps: ['Role-specific digest can mapping user-role-permission va source priority ro hon.']
  }
];

export function buildAiOperatorKnowledge(role?: string) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const selectedPlaybooks = normalizedRole
    ? ROLE_PLAYBOOKS.filter((item) => item.role === normalizedRole || item.title.toLowerCase().includes(normalizedRole))
    : ROLE_PLAYBOOKS;
  const selectedScenarioWorkflows = normalizedRole
    ? SCENARIO_WORKFLOWS.filter((item) => item.roles.some((candidate) => roleAliasMatches(normalizedRole, candidate)))
    : SCENARIO_WORKFLOWS;

  return {
    apiCatalog: ERP_API_CATALOG,
    rolePlaybooks: selectedPlaybooks.length ? selectedPlaybooks : ROLE_PLAYBOOKS,
    scenarioWorkflows: selectedScenarioWorkflows.length ? selectedScenarioWorkflows : SCENARIO_WORKFLOWS,
    questionPlaybook: AI_OPERATOR_QUESTION_PLAYBOOK,
    tokenManagement: AI_TOKEN_MANAGEMENT_GUIDE,
    guardrails: AI_ASSISTANT_GUARDRAILS
  };
}

function roleAliasMatches(requestedRole: string, candidate: AiOperatorAudience) {
  if (requestedRole === candidate) return true;
  if (requestedRole === 'sale' && candidate === 'sales') return true;
  if (requestedRole === 'sales' && candidate === 'agent') return true;
  if (requestedRole === 'agent' && candidate === 'sales') return true;
  if (requestedRole === 'cfo' && candidate === 'accountant') return true;
  if (requestedRole === 'accounting' && candidate === 'accountant') return true;
  return false;
}
