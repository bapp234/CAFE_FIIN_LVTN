import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LucideCheck,
  LucideDownload,
  LucideEye,
  LucideEyeOff,
  LucideRotateCcw,
  LucideUserPlus,
} from '@lucide/angular';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import {
  HrmEmployeeApi,
  RoleSummary,
  UnprovisionedEmployee,
} from '../../../services/hrm_employee_api';

export interface InlineAccountDraft {
  username: string;
  password: string;
  roleId: number;
  showPassword?: boolean;
  isSubmitting?: boolean;
}

const DEFAULT_ROLES: RoleSummary[] = [
  { roleId: 1, roleName: 'Admin', description: 'Quản trị viên toàn hệ thống', hierarchyLevel: 5, memberCount: 0, badgeColor: 'red' },
  { roleId: 2, roleName: 'HRM', description: 'Quản trị nhân sự & Chấm công', hierarchyLevel: 4, memberCount: 0, badgeColor: 'blue' },
  { roleId: 3, roleName: 'Manager', description: 'Cửa hàng trưởng & Quản lý ca', hierarchyLevel: 3, memberCount: 0, badgeColor: 'amber' },
  { roleId: 4, roleName: 'Cashier', description: 'Nhân viên thu ngân & POS', hierarchyLevel: 2, memberCount: 0, badgeColor: 'emerald' },
  { roleId: 5, roleName: 'Barista', description: 'Nhân viên pha chế & phục vụ', hierarchyLevel: 1, memberCount: 0, badgeColor: 'cyan' },
];

@Component({
  selector: 'app-employee-unprovisioned',
  templateUrl: './employee_unprovisioned.html',
  styleUrl: './employee_unprovisioned.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideCheck,
    LucideDownload,
    LucideEye,
    LucideEyeOff,
    LucideRotateCcw,
    LucideUserPlus,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminSearchBoxComponent,
    AdminGridTableComponent,
    AdminModal,
  ],
})
export class EmployeeUnprovisioned {
  readonly branchService = inject(AdminBranchService);
  readonly toastService = inject(AdminToastService);
  readonly employeeApi = inject(HrmEmployeeApi);
  readonly router = inject(Router);

  // ---- Dữ liệu chính & Phân trang cuộn lười (Lazy Load 50 nhân sự) ----
  readonly isLoading = signal(false);
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);
  readonly pageIndex = signal(1);
  readonly pageSize = 50;
  readonly hasMore = signal(true);
  readonly isLoadingMore = signal(false);
  readonly unprovisionedList = signal<UnprovisionedEmployee[]>([]);
  readonly roles = signal<RoleSummary[]>([]);
  readonly availableRoles = computed<RoleSummary[]>(() => {
    const r = this.roles();
    return r && r.length > 0 ? r : DEFAULT_ROLES;
  });

  // ---- Bộ lưu trữ trạng thái chỉnh sửa trực tiếp trên bảng (Editable Grid Drafts) ----
  readonly drafts = signal<Record<number, InlineAccountDraft>>({});

  // ---- Trạng thái lưu thay đổi bảng inline ----
  readonly isSavingChanges = signal(false);

  // ---- Danh sách ID các nhân sự đã chỉnh sửa khác với mặc định ----
  readonly modifiedEmployeeIds = computed<number[]>(() => {
    const list = this.unprovisionedList();
    const dMap = this.drafts();
    const modified: number[] = [];

    for (const emp of list) {
      const d = dMap[emp.employeeId];
      if (!d) continue;
      const def = this.createDefaultDraft(emp);
      if (d.username !== def.username || d.password !== def.password || d.roleId !== def.roleId) {
        modified.push(emp.employeeId);
      }
    }
    return modified;
  });

  readonly hasUnsavedChanges = computed(() => this.modifiedEmployeeIds().length > 0);

  // ---- Bộ lọc & Tìm kiếm ----
  readonly searchQuery = signal('');
  readonly positionFilter = signal('all');

  // ---- Danh sách chọn nhiều (Bulk Action) ----
  readonly selectedEmployeeIds = signal<number[]>([]);

  // ---- Modal xác nhận cấp tài khoản ----
  readonly isBulkModalOpen = signal(false);
  readonly isBulkProcessing = signal(false);

  // ---- Combobox Options ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly positionOptions = computed<ComboOption[]>(() => {
    const set = new Set<string>();
    this.unprovisionedList().forEach((e) => {
      if (e.position) set.add(e.position);
    });
    return [
      { value: 'all', label: 'Tất cả chức vụ' },
      ...Array.from(set).map((pos) => ({ value: pos, label: pos })),
    ];
  });

  // ---- Danh sách sau khi lọc ----
  readonly filteredEmployees = computed<UnprovisionedEmployee[]>(() => {
    const list = this.unprovisionedList();
    const q = this.searchQuery().toLowerCase().trim();
    const branchId = this.branchService.selectedBranchId();
    const pos = this.positionFilter();

    return list.filter((emp) => {
      // 1. Lọc chi nhánh
      if (branchId && branchId !== 'all') {
        const b = this.branchService.branches().find((br) => String(br.id) === branchId);
        if (b && emp.branchName && !emp.branchName.toLowerCase().includes(b.name.toLowerCase())) {
          return false;
        }
      }

      // 2. Lọc chức vụ
      if (pos !== 'all' && emp.position !== pos) {
        return false;
      }

      // 3. Tìm kiếm theo mã, họ tên, chức danh, chi nhánh
      if (q) {
        const matchCode = (emp.employeeCode || '').toLowerCase().includes(q);
        const matchName = (emp.fullName || '').toLowerCase().includes(q);
        const matchPos = (emp.position || '').toLowerCase().includes(q);
        const matchBranch = (emp.branchName || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPos && !matchBranch) {
          return false;
        }
      }

      return true;
    });
  });

  readonly selectedEmployees = computed<UnprovisionedEmployee[]>(() => {
    const ids = new Set(this.selectedEmployeeIds());
    return this.unprovisionedList().filter((e) => ids.has(e.employeeId));
  });

  readonly isAllSelected = computed<boolean>(() => {
    const filtered = this.filteredEmployees();
    if (filtered.length === 0) return false;
    const ids = new Set(this.selectedEmployeeIds());
    return filtered.every((e) => ids.has(e.employeeId));
  });

  // ---- Cấu hình cột hiển thị cho AdminGridTable ----
  readonly columns = computed<GridColumn[]>(() => [
    {
      key: 'employeeCode',
      label: 'Mã NV',
      type: 'code',
      width: '7.5rem',
      align: 'center',
      sortable: true,
    },
    {
      key: 'fullName',
      label: 'Họ và tên nhân sự',
      width: '15rem',
      bold: true,
      sortable: true,
    },
    {
      key: 'position',
      label: 'Chức vụ / Vị trí',
      type: 'pill',
      width: '12rem',
      sortable: true,
    },
    {
      key: 'branchName',
      label: 'Chi nhánh',
      type: 'pill',
      width: '13rem',
      sortable: true,
    },
    {
      key: 'username',
      label: 'Tài khoản cấp',
      width: '13.5rem',
      editable: true,
    },
    {
      key: 'password',
      label: 'Mật khẩu cấp',
      width: '12.5rem',
      editable: true,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      width: '7.5rem',
      align: 'center',
      editable: true,
    },
  ]);

  readonly tableRows = computed<GridRow[]>(() => {
    return this.filteredEmployees().map((emp) => {
      const draft = this.getDraft(emp);
      return {
        ...emp,
        id: emp.employeeId,
        username: draft.username,
        password: draft.password,
        roleId: draft.roleId,
        _raw: emp,
      };
    });
  });

  onGridRowClick(row: GridRow): void {
    const empId = Number(row['employeeId'] || row['id']);
    if (empId) {
      this.toggleSelect(empId);
    }
  }

  constructor() {
    this.loadData();

    // Tự động phản ứng khi chi nhánh trung tâm thay đổi
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.selectedEmployeeIds.set([]);
      });
    });
  }

  loadData(reset: boolean = true): void {
    if (reset) {
      this.pageIndex.set(1);
      this.hasMore.set(true);
      this.isLoading.set(true);
    }

    this.employeeApi.getRoleSummaries().subscribe({
      next: (roleList) => {
        this.roles.set(roleList || []);
      },
      error: () => {},
    });

    const bId = this.branchService.selectedBranchId();
    const branchIdNum = bId && bId !== 'all' ? Number(bId) : null;

    this.employeeApi
      .getUnprovisionedEmployees({
        pageIndex: 1,
        pageSize: this.pageSize,
        branchId: branchIdNum,
        search: this.searchQuery(),
      })
      .subscribe({
        next: (list) => {
          this.unprovisionedList.set(list || []);
          this.hasMore.set((list || []).length >= this.pageSize);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toastService.error('Không thể tải danh sách tài khoản chưa thiết lập.');
        },
      });
  }

  onScrollToBottom(): void {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMore()) return;

    this.isLoadingMore.set(true);
    const nextPage = this.pageIndex() + 1;
    const bId = this.branchService.selectedBranchId();
    const branchIdNum = bId && bId !== 'all' ? Number(bId) : null;

    this.employeeApi
      .getUnprovisionedEmployees({
        pageIndex: nextPage,
        pageSize: this.pageSize,
        branchId: branchIdNum,
        search: this.searchQuery(),
      })
      .subscribe({
        next: (newList) => {
          this.pageIndex.set(nextPage);
          if (!newList || newList.length < this.pageSize) {
            this.hasMore.set(false);
          }
          this.unprovisionedList.update((curr) => [...curr, ...(newList || [])]);
          this.isLoadingMore.set(false);
        },
        error: () => {
          this.isLoadingMore.set(false);
        },
      });
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  onBranchFilterChange(branchId: string): void {
    this.branchService.selectBranch(branchId);
  }

  onPositionFilterChange(position: string): void {
    this.positionFilter.set(position);
  }

  // =========================================================================
  // CHỌN HÀNG LOẠT (SELECTION LOGIC)
  // =========================================================================
  toggleSelectAll(): void {
    const filtered = this.filteredEmployees();
    if (this.isAllSelected()) {
      const filteredIds = new Set(filtered.map((e) => e.employeeId));
      this.selectedEmployeeIds.update((curr) => curr.filter((id) => !filteredIds.has(id)));
    } else {
      const currIds = new Set(this.selectedEmployeeIds());
      filtered.forEach((e) => currIds.add(e.employeeId));
      this.selectedEmployeeIds.set(Array.from(currIds));
    }
  }

  toggleSelect(id: number): void {
    this.selectedEmployeeIds.update((curr) => {
      if (curr.includes(id)) {
        return curr.filter((i) => i !== id);
      }
      return [...curr, id];
    });
  }

  clearSelection(): void {
    this.selectedEmployeeIds.set([]);
  }

  // =========================================================================
  // GỢI Ý VAI TRÒ HỆ THỐNG DỰA TRÊN CHỨC VỤ (SMART ROLE MATCHING)
  // =========================================================================
  getSuggestedRole(position: string): { roleId: number; roleName: string; badgeColor: string } {
    const p = (position || '').toLowerCase();
    if (p.includes('quản trị') || p.includes('admin') || p.includes('giám đốc')) {
      return { roleId: 1, roleName: 'Admin', badgeColor: 'red' };
    }
    if (p.includes('nhân sự') || p.includes('hrm')) {
      return { roleId: 2, roleName: 'HRM', badgeColor: 'blue' };
    }
    if (p.includes('quản lý') || p.includes('cửa hàng trưởng') || p.includes('trưởng ca') || p.includes('giám sát')) {
      return { roleId: 3, roleName: 'Manager', badgeColor: 'amber' };
    }
    if (p.includes('thu ngân') || p.includes('cashier')) {
      return { roleId: 4, roleName: 'Cashier', badgeColor: 'emerald' };
    }
    return { roleId: 5, roleName: 'Barista', badgeColor: 'cyan' };
  }

  getRoleNameById(roleId: number): string {
    const r = this.roles().find((it) => it.roleId === roleId);
    return r ? r.roleName : 'Barista';
  }

  // =========================================================================
  // CHỈNH SỬA TRỰC TIẾP TRÊN BẢNG NHƯ EXCEL (INLINE EDITABLE GRID)
  // =========================================================================
  createDefaultDraft(emp: any): InlineAccountDraft {
    const suggested = this.getSuggestedRole(emp?.position || '');
    const cleanCode = (emp?.employeeCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      username: `nv_${cleanCode}`,
      password: 'Fiin@2026',
      roleId: suggested.roleId,
      showPassword: false,
      isSubmitting: false,
    };
  }

  getDraft(emp: any): InlineAccountDraft {
    if (!emp) return this.ensureDraftExists(0);
    const empId = Number(emp.employeeId || emp.id || 0);
    const d = this.drafts()[empId];
    if (d) return d;
    return this.createDefaultDraft(emp);
  }

  private ensureDraftExists(empId: number): InlineAccountDraft {
    const current = this.drafts()[empId];
    if (current) return current;
    const emp = this.unprovisionedList().find((e) => e.employeeId === empId);
    if (emp) return this.createDefaultDraft(emp);
    return {
      username: `nv_${empId}`,
      password: 'Fiin@2026',
      roleId: 5,
      showPassword: false,
      isSubmitting: false,
    };
  }

  updateUsername(empId: number, username: string): void {
    this.drafts.update((curr) => {
      const existing = curr[empId] || this.ensureDraftExists(empId);
      return {
        ...curr,
        [empId]: { ...existing, username },
      };
    });
  }

  updatePassword(empId: number, password: string): void {
    this.drafts.update((curr) => {
      const existing = curr[empId] || this.ensureDraftExists(empId);
      return {
        ...curr,
        [empId]: { ...existing, password },
      };
    });
  }

  updateRoleId(empId: number, roleId: number): void {
    this.drafts.update((curr) => {
      const existing = curr[empId] || this.ensureDraftExists(empId);
      return {
        ...curr,
        [empId]: { ...existing, roleId },
      };
    });
  }

  toggleShowPassword(empId: number): void {
    this.drafts.update((curr) => {
      const existing = curr[empId] || this.ensureDraftExists(empId);
      return {
        ...curr,
        [empId]: { ...existing, showPassword: !existing.showPassword },
      };
    });
  }

  submitInlineAccount(emp: UnprovisionedEmployee): void {
    const draft = this.getDraft(emp);
    const u = (draft.username || '').trim();
    const p = (draft.password || '').trim();

    if (!u) {
      this.toastService.warning(`Vui lòng nhập tên tài khoản cho nhân sự ${emp.fullName}.`);
      return;
    }
    if (!p || p.length < 6) {
      this.toastService.warning(`Mật khẩu cho nhân sự ${emp.fullName} phải từ 6 ký tự trở lên.`);
      return;
    }

    this.drafts.update((curr) => ({
      ...curr,
      [emp.employeeId]: { ...draft, isSubmitting: true },
    }));

    const req = {
      employeeId: emp.employeeId,
      username: u,
      password: p,
      roleId: draft.roleId,
      mustChangePassword: true,
    };

    this.employeeApi.createAccountForEmployee(req).subscribe({
      next: (res) => {
        this.toastService.success(
          res.message || `Đã cấp tài khoản [${u}] cho nhân sự ${emp.fullName} thành công!`
        );
        this.unprovisionedList.update((curr) => curr.filter((it) => it.employeeId !== emp.employeeId));
        this.selectedEmployeeIds.update((curr) => curr.filter((id) => id !== emp.employeeId));
        this.drafts.update((curr) => {
          const copy = { ...curr };
          delete copy[emp.employeeId];
          return copy;
        });
      },
      error: (err: any) => {
        this.drafts.update((curr) => ({
          ...curr,
          [emp.employeeId]: { ...draft, isSubmitting: false },
        }));
        const msg = err?.error?.message || `Có lỗi xảy ra khi tạo tài khoản cho ${emp.fullName}.`;
        this.toastService.error(msg);
      },
    });
  }

  // =========================================================================
  // THEO DÕI THAY ĐỔI & LƯU / LÀM LẠI HÀNG LOẠT
  // =========================================================================
  isUsernameModified(emp: any): boolean {
    const empId = Number(emp?.employeeId || emp?.id || 0);
    const d = this.drafts()[empId];
    if (!d) return false;
    const def = this.createDefaultDraft(emp);
    return d.username !== def.username;
  }

  isPasswordModified(emp: any): boolean {
    const empId = Number(emp?.employeeId || emp?.id || 0);
    const d = this.drafts()[empId];
    if (!d) return false;
    const def = this.createDefaultDraft(emp);
    return d.password !== def.password;
  }

  isRoleModified(emp: any): boolean {
    const empId = Number(emp?.employeeId || emp?.id || 0);
    const d = this.drafts()[empId];
    if (!d) return false;
    const def = this.createDefaultDraft(emp);
    return d.roleId !== def.roleId;
  }

  isModified(empId: number): boolean {
    const emp = this.unprovisionedList().find((e) => e.employeeId === empId);
    if (!emp) return false;
    return this.isUsernameModified(emp) || this.isPasswordModified(emp);
  }

  onRowClick(event: MouseEvent, empId: number): void {
    const target = event.target as HTMLElement;
    // Bỏ qua nếu bấm trực tiếp vào input, select, button, svg hoặc mắt mật khẩu
    if (
      target.closest('input') ||
      target.closest('select') ||
      target.closest('button') ||
      target.closest('.cell-excel-wrap')
    ) {
      return;
    }
    this.toggleSelect(empId);
  }

  revertChanges(): void {
    const count = this.modifiedEmployeeIds().length;
    this.drafts.set({});
    this.toastService.info(`Đã làm lại và khôi phục mặc định cho ${count} nhân sự.`);
  }

  saveAllChanges(): void {
    const ids = this.modifiedEmployeeIds();
    if (ids.length === 0) return;

    const list = this.unprovisionedList().filter((e) => ids.includes(e.employeeId));

    // Validate dữ liệu trước khi gửi
    for (const emp of list) {
      const draft = this.getDraft(emp);
      if (!draft.username.trim()) {
        this.toastService.warning(`Vui lòng nhập tên tài khoản cho nhân sự ${emp.fullName}.`);
        return;
      }
      if (!draft.password || draft.password.length < 6) {
        this.toastService.warning(`Mật khẩu cho nhân sự ${emp.fullName} phải từ 6 ký tự trở lên.`);
        return;
      }
    }

    this.isSavingChanges.set(true);

    const requests = list.map((emp) => {
      const draft = this.getDraft(emp);
      return this.employeeApi.createAccountForEmployee({
        employeeId: emp.employeeId,
        username: draft.username.trim(),
        password: draft.password,
        roleId: draft.roleId,
        mustChangePassword: true,
      });
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.isSavingChanges.set(false);
        this.toastService.success(`Đã lưu và cấp tài khoản thành công cho ${list.length} nhân sự!`);

        const setIds = new Set(ids);
        this.unprovisionedList.update((curr) => curr.filter((u) => !setIds.has(u.employeeId)));
        this.selectedEmployeeIds.update((curr) => curr.filter((id) => !setIds.has(id)));
        this.drafts.update((curr) => {
          const copy = { ...curr };
          ids.forEach((id) => delete copy[id]);
          return copy;
        });
      },
      error: (err: any) => {
        this.isSavingChanges.set(false);
        const msg = err?.error?.message || 'Có lỗi xảy ra khi lưu các thay đổi tài khoản.';
        this.toastService.error(msg);
      },
    });
  }

  // =========================================================================
  // MODAL XÁC NHẬN CẤP TÀI KHOẢN DỰA TRÊN DỮ LIỆU ĐANG NHẬP TRÊN BẢNG
  // =========================================================================
  openBulkCreateModal(): void {
    if (this.selectedEmployeeIds().length === 0) {
      this.toastService.warning('Vui lòng chọn ít nhất một nhân sự để cấp tài khoản.');
      return;
    }
    this.isBulkModalOpen.set(true);
  }

  confirmBulkCreate(): void {
    const ids = this.selectedEmployeeIds();
    if (ids.length === 0) return;

    const list = this.unprovisionedList().filter((e) => ids.includes(e.employeeId));

    // Kiểm tra dữ liệu hợp lệ của các nhân sự đã chọn
    for (const emp of list) {
      const draft = this.getDraft(emp);
      if (!draft.username.trim()) {
        this.toastService.warning(`Vui lòng nhập tên tài khoản cho nhân sự ${emp.fullName}.`);
        return;
      }
      if (!draft.password || draft.password.length < 6) {
        this.toastService.warning(`Mật khẩu cho nhân sự ${emp.fullName} phải từ 6 ký tự trở lên.`);
        return;
      }
    }

    this.isBulkProcessing.set(true);

    // Cấp tài khoản dựa trên đúng username, password, roleId đang nhập trên bảng
    const requests = list.map((emp) => {
      const draft = this.getDraft(emp);
      return this.employeeApi.createAccountForEmployee({
        employeeId: emp.employeeId,
        username: draft.username.trim(),
        password: draft.password,
        roleId: draft.roleId,
        mustChangePassword: true,
      });
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.isBulkProcessing.set(false);
        this.isBulkModalOpen.set(false);
        this.toastService.success(
          `Đã hoàn tất cấp tài khoản thành công cho ${list.length} nhân sự!`
        );

        // Loại bỏ các nhân sự đã cấp khỏi danh sách
        const setIds = new Set(ids);
        this.unprovisionedList.update((curr) =>
          curr.filter((u) => !setIds.has(u.employeeId))
        );
        this.selectedEmployeeIds.set([]);
        this.drafts.update((curr) => {
          const copy = { ...curr };
          ids.forEach((id) => delete copy[id]);
          return copy;
        });
      },
      error: (err: any) => {
        this.isBulkProcessing.set(false);
        const msg = err?.error?.message || 'Có lỗi xảy ra khi thực hiện cấp tài khoản.';
        this.toastService.error(msg);
      },
    });
  }

  // =========================================================================
  // XUẤT FILE EXCEL DANH SÁCH CHƯA THIẾT LẬP
  // =========================================================================
  openExportConfirm(): void {
    if (this.filteredEmployees().length === 0) {
      this.toastService.warning('Không có dữ liệu nhân sự để xuất báo cáo.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportUnprovisionedExcel(): void {
    const list = this.filteredEmployees();
    if (list.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const headers = [
      'Mã nhân viên',
      'Họ và tên',
      'Vị trí chức danh',
      'Chi nhánh',
      'Trạng thái hồ sơ',
      'Vai trò đề xuất',
      'Trạng thái tài khoản',
    ];

    const payloadRows = list.map((e) => ({
      'Mã nhân viên': e.employeeCode ?? '',
      'Họ và tên': e.fullName ?? '',
      'Vị trí chức danh': e.position ?? '',
      'Chi nhánh': e.branchName ?? '',
      'Trạng thái hồ sơ': e.status === 'active' ? 'Đang làm việc' : (e.status ?? ''),
      'Vai trò đề xuất': this.getSuggestedRole(e.position).roleName,
      'Trạng thái tài khoản': 'Chưa cấp tài khoản',
    }));

    const fileName = `Fiin_HRM_Nhan_Su_Chua_Cap_Tai_Khoan_${new Date().toISOString().slice(0, 10)}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Unprovisioned',
        sheetName: 'Chưa thiết lập TK',
        reportTitle: 'DANH SÁCH NHÂN SỰ CHƯA THIẾT LẬP TÀI KHOẢN',
        summaryLabel: 'Tổng số nhân sự:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.isExportConfirmOpen.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất ${list.length} nhân sự chưa có tài khoản ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel. Vui lòng thử lại.');
        },
      });
  }

  // =========================================================================
  // XEM HỒ SƠ CHI TIẾT
  // =========================================================================
  viewEmployeeProfile(emp: UnprovisionedEmployee): void {
    void this.router.navigate(['/admin/hrm/ho-so-nhan-vien'], {
      queryParams: { id: emp.employeeId },
    });
  }
}
