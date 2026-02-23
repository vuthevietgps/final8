import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../user/user.model';

@Component({
  selector: 'app-agent-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './agent-list.component.html',
  styleUrls: ['./agent-list.component.css']
})
export class AgentListComponent implements OnInit {
  private userService = inject(UserService);

  agents = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  searchTerm = signal('');
  statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  roleFilter = signal<'all' | 'internal' | 'external'>('all');

  summary = computed(() => {
    const list = this.agents();
    const internal = list.filter(u => u.role === UserRole.INTERNAL_AGENT);
    const external = list.filter(u => u.role === UserRole.EXTERNAL_AGENT);
    const active = list.filter(u => u.isActive !== false);
    const inactive = list.filter(u => u.isActive === false);
    return {
      total: list.length,
      internal: internal.length,
      external: external.length,
      active: active.length,
      inactive: inactive.length
    };
  });

  async ngOnInit(): Promise<void> {
    await this.loadAgents();
  }

  async loadAgents(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [internalAgents, externalAgents] = await Promise.all([
        firstValueFrom(this.userService.getUsers(UserRole.INTERNAL_AGENT)),
        firstValueFrom(this.userService.getUsers(UserRole.EXTERNAL_AGENT))
      ]);
      const merged = [...(internalAgents || []), ...(externalAgents || [])]
        .map(agent => ({ ...agent, isActive: agent.isActive !== false }));
      merged.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      this.agents.set(merged);
    } catch (err) {
      console.error('Failed to load agents', err);
      this.error.set('Không tải được danh sách đại lý');
    } finally {
      this.loading.set(false);
    }
  }

  filteredAgents(): User[] {
    let list = [...this.agents()];

    if (this.roleFilter() === 'internal') {
      list = list.filter(u => u.role === UserRole.INTERNAL_AGENT);
    }
    if (this.roleFilter() === 'external') {
      list = list.filter(u => u.role === UserRole.EXTERNAL_AGENT);
    }

    if (this.statusFilter() === 'active') {
      list = list.filter(u => u.isActive !== false);
    }
    if (this.statusFilter() === 'inactive') {
      list = list.filter(u => u.isActive === false);
    }

    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      list = list.filter(u => {
        return (
          (u.fullName || '').toLowerCase().includes(term) ||
          (u.email || '').toLowerCase().includes(term) ||
          (u.phone || '').toLowerCase().includes(term)
        );
      });
    }

    return list;
  }

  getRoleLabel(role: UserRole): string {
    const roleLabels: Record<UserRole, string> = {
      [UserRole.DIRECTOR]: 'Giám Đốc',
      [UserRole.MANAGER]: 'Quản Lý',
      [UserRole.EMPLOYEE]: 'Nhân Viên',
      [UserRole.INTERNAL_AGENT]: 'Đại Lý Nội Bộ',
      [UserRole.EXTERNAL_AGENT]: 'Đại Lý Ngoài',
      [UserRole.INTERNAL_SUPPLIER]: 'NCC Nội Bộ',
      [UserRole.EXTERNAL_SUPPLIER]: 'NCC Ngoài',
      [UserRole.INVESTOR]: 'Nhà Đầu Tư',
      [UserRole.LENDER]: 'Người Cho Vay'
    };
    return roleLabels[role] || role;
  }

  getStatusLabel(isActive: boolean | undefined): string {
    return isActive === false ? 'Không hoạt động' : 'Hoạt động';
  }
}
