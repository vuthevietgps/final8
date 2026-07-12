import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface JumpLink {
  id: string;
  label: string;
}

interface HeroMetric {
  value: string;
  label: string;
  note: string;
}

interface QuickAction {
  title: string;
  summary: string;
  route: string;
  queryParams?: Record<string, string>;
  cta: string;
  note: string;
}

interface WorkspaceCard {
  title: string;
  summary: string;
  route: string;
  cta: string;
  checkpoint: string;
}

interface CadenceBlock {
  label: string;
  time: string;
  goal: string;
  checklist: string[];
}

interface PrincipleCard {
  title: string;
  body: string;
}

@Component({
  selector: 'app-manager-handbook',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './manager-handbook.component.html',
  styleUrl: './manager-handbook.component.css'
})
export class ManagerHandbookComponent {
  constructor(public authService: AuthService) {}

  readonly welcomeName = computed(() => {
    const fullName = this.authService.user()?.fullName?.trim();
    if (!fullName) {
      return 'Manager';
    }

    return fullName.split(/\s+/).slice(-2).join(' ');
  });

  readonly jumpLinks: JumpLink[] = [
    { id: 'quick-start', label: 'Vào việc nhanh' },
    { id: 'workspaces', label: 'Màn hình chính' },
    { id: 'cadence', label: 'Nhịp trong ngày' },
    { id: 'principles', label: 'Nguyên tắc điều hành' },
    { id: 'handoff', label: 'Bàn giao cuối ngày' }
  ];

  readonly heroMetrics: HeroMetric[] = [
    {
      value: '1 nơi',
      label: 'Xử lý việc Ads khẩn cấp',
      note: 'Toàn bộ checklist nóng đã gom về tab Hành động khẩn cấp trong Ads Budget.'
    },
    {
      value: '4 bước',
      label: 'Mở ca gọn',
      note: 'Ngân sách, đội ngũ, asset và inbox là đủ để chốt ưu tiên đầu ngày.'
    },
    {
      value: '1 mẫu',
      label: 'Bàn giao cuối ngày',
      note: 'Chỉ cần kết quả, rủi ro, owner và đề xuất là giám đốc có thể quyết nhanh.'
    }
  ];

  readonly quickActions: QuickAction[] = [
    {
      title: 'Có việc Ads nóng',
      summary: 'Mở thẳng tab Hành động khẩn cấp để xem checklist tạo nhóm, đổi ngân sách, tạm dừng và nhu cầu tiền.',
      route: '/ads-budget',
      queryParams: { tab: 'emergency' },
      cta: 'Mở tab khẩn cấp',
      note: 'Dùng khi cần xử lý ngay trong ngày, không đọc SOP dài ở handbook nữa.'
    },
    {
      title: 'Cần chốt tăng hay giảm ngân sách',
      summary: 'Ở Ads Budget tab đề xuất, manager chốt tăng, giữ, giảm hoặc tắt theo dữ liệu hiện tại.',
      route: '/ads-budget',
      cta: 'Mở Ads Budget',
      note: 'Kết thúc bằng quyết định rõ ràng và mốc giờ review lại.'
    },
    {
      title: 'Cần nhìn sức tải của team',
      summary: 'Mở KPI Nhân viên Ads để xem ai tụt nhịp, ai quá tải và ai có thể nhận việc nóng.',
      route: '/employee-ads-kpi',
      cta: 'Mở KPI team',
      note: 'Dùng để điều phối người trước khi dồn việc vào một cá nhân.'
    }
  ];

  readonly workspaceCards: WorkspaceCard[] = [
    {
      title: 'Ads Budget',
      summary: 'Màn hình số 1 để chốt hướng đi cho nhóm quảng cáo, gồm cả phần đề xuất chi tiêu và Hành động khẩn cấp.',
      route: '/ads-budget',
      cta: 'Vào Ads Budget',
      checkpoint: 'Phải trả lời được hôm nay nhóm nào tăng, nhóm nào giữ, nhóm nào dừng.'
    },
    {
      title: 'KPI Nhân viên Ads',
      summary: 'Dùng để xem tải công việc, backlog và chất lượng phản ứng của team theo người.',
      route: '/employee-ads-kpi',
      cta: 'Xem KPI team',
      checkpoint: 'Nêu được 3 người cần hỗ trợ và 3 người có thể gánh thêm việc.'
    },
    {
      title: 'Media',
      summary: 'Kiểm tra asset có đủ cho chiến dịch trong ngày, tránh quyết định scale khi nội dung chưa sẵn sàng.',
      route: '/media',
      cta: 'Mở Media',
      checkpoint: 'Không để chiến dịch lên lịch chạy mà còn thiếu hình, video hay mô tả.'
    },
    {
      title: 'Fanpage và hội thoại',
      summary: 'Rà tình trạng page, token, webhook và những inbox nóng đang chờ phản hồi.',
      route: '/fanpages',
      cta: 'Mở Fanpage',
      checkpoint: 'Page lỗi kết nối hoặc inbox quá SLA phải có owner xử lý trong ngày.'
    },
    {
      title: 'Ads API Tokens',
      summary: 'Chỉ mở khi token quảng cáo hết hạn, thiếu scope hoặc luồng đồng bộ chi phí bị ngắt.',
      route: '/api-tokens',
      cta: 'Xem Ads tokens',
      checkpoint: 'Mọi Ads token sắp hết hạn phải có người phụ trách và thời hạn gia hạn.'
    }
  ];

  readonly cadenceBlocks: CadenceBlock[] = [
    {
      label: 'Đầu ngày',
      time: '08:00 - 08:30',
      goal: 'Chốt ưu tiên, không đi quá sâu vào xử lý chi tiết.',
      checklist: [
        'Mở Ads Budget để xem nhóm nào đang cháy tiền hoặc có cơ hội scale.',
        'Mở KPI team để nhìn sức tải thật của đội trước khi giao việc.',
        'Kiểm tra Media và Fanpage để chặn sớm các lỗi làm gián đoạn vận hành.'
      ]
    },
    {
      label: 'Giữa ngày',
      time: '11:00 - 14:00',
      goal: 'Điều phối nguồn lực và ra quyết định giữa ca.',
      checklist: [
        'Nếu có incident Ads, chuyển thẳng sang tab Hành động khẩn cấp.',
        'So lại các nhóm có CPL hoặc CPA xấu để giảm chi hoặc dừng.',
        'Dời người giữa Ads, media và chat khi backlog bắt đầu lệch.'
      ]
    },
    {
      label: 'Cuối ngày',
      time: '16:30 - 18:00',
      goal: 'Bàn giao để sáng hôm sau có thể hành động ngay.',
      checklist: [
        'Chốt kết quả nổi bật, rủi ro còn mở và người theo tiếp.',
        'Đính kèm quyết định cần giám đốc duyệt thay vì chỉ báo có vấn đề.',
        'Nếu một lỗi lặp lại nhiều lần, biến nó thành checklist hoặc rule mới.'
      ]
    }
  ];

  readonly principles: PrincipleCard[] = [
    {
      title: 'Handbook chỉ để định hướng',
      body: 'Trang này không còn ôm SOP xử lý khẩn cấp. Khi việc nóng liên quan Ads xuất hiện, manager vào Ads Budget để thao tác tập trung ở đúng nơi.'
    },
    {
      title: 'Ra quyết định trước, phân tích sâu sau',
      body: 'Nếu nhóm đang đốt tiền hoặc làm nghẽn SLA, ưu tiên chặn rủi ro ngay rồi mới phân tích nguyên nhân sau khi hệ thống ổn định.'
    },
    {
      title: 'Điều phối người theo dữ liệu thật',
      body: 'KPI và backlog quyết định ai nhận thêm việc, ai cần coaching và ai cần được giải phóng bớt đầu việc.'
    },
    {
      title: 'Bàn giao phải dẫn đến hành động',
      body: 'Một handoff tốt luôn có kết quả, rủi ro, owner và đề xuất để ca sau hoặc giám đốc chốt được ngay.'
    }
  ];

  readonly handoffChecklist: string[] = [
    '2-3 kết quả quan trọng nhất trong ngày.',
    '2-3 rủi ro còn mở và mức độ ảnh hưởng.',
    'Owner đang theo từng việc và mốc cần cập nhật tiếp theo.',
    'Quyết định hoặc hỗ trợ cần giám đốc duyệt vào sáng hôm sau.'
  ];

  readonly handoffTemplate = `[Kết quả]
1. Nhóm A giữ hiệu quả tốt, đã tăng ngân sách trong khung an toàn.
2. Team chat đã xử lý xong backlog hội thoại nóng trước 14:00.

[Rủi ro]
1. Page X sắp hết Ads/Page token lúc 10:00 ngày mai - owner: Linh.
2. Asset cho chiến dịch Y còn thiếu 2 visual - owner: Nam.

[Đề xuất]
1. Duyệt thêm ngân sách cho các nhóm đang ổn định.
2. Lùi giờ launch chiến dịch Y sang 14:00 ngày mai nếu media chưa hoàn tất.`;
}
