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
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  LucideCheck,
  LucidePlus,
  LucideRotateCcw,
  LucideShieldCheck,
  LucideX,
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
import {
  EmployeePermissionSettingItem,
  HrmEmployeeApi,
  PermissionItem,
  RoleModalItem,
  RolePermissionMapping,
} from '../../../services/hrm_employee_api';

export const APPROVAL_LEVEL_OPTIONS: ComboOption[] = [
  { value: 'all', label: 'Tất cả cấp duyệt' },
  { value: '0', label: 'Không có quyền duyệt' },
  { value: '1', label: 'Cấp 1' },
  { value: '2', label: 'Cấp 2' },
  { value: '3', label: 'Cấp 3' },
];

export const ROW_APPROVAL_LEVEL_OPTIONS = [
  { value: 0, label: '0 - Không duyệt' },
  { value: 1, label: 'Cấp 1' },
  { value: 2, label: 'Cấp 2' },
  { value: 3, label: 'Cấp 3' },
];

@Component({
  selector: 'app-employee-settings',
  templateUrl: './employee_settings.html',
  styleUrl: './employee_settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCheck,
    LucidePlus,
    LucideRotateCcw,
    LucideShieldCheck,
    LucideX,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminSearchBoxComponent,
    AdminGridTableComponent,
  ],
})
export class EmployeeSettings {
  readonly branchService = inject(AdminBranchService);
  readonly toastService = inject(AdminToastService);
  readonly employeeApi = inject(HrmEmployeeApi);

  // ---- Dữ liệu chính ----
  readonly isLoading = signal(false);
  readonly employeeList = signal<EmployeePermissionSettingItem[]>([]);

  // ---- Bộ lọc & Tìm kiếm ----
  readonly searchQuery = signal('');
  readonly levelFilter = signal('all');

  // ---- Chọn nhân sự trên lưới & Gán cấp duyệt hàng loạt ----
  readonly selectedEmployeeIds = signal<number[]>([]);
  readonly bulkApprovalLevel = signal<string>('1');
  readonly isBulkUpdatingLevel = signal(false);
  readonly bulkLevelOptions: ComboOption[] = ROW_APPROVAL_LEVEL_OPTIONS.map((o) => ({
    value: String(o.value),
    label: o.label,
  }));

  // ---- Tùy chọn Bộ lọc Combobox ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly approvalLevelFilterOptions = APPROVAL_LEVEL_OPTIONS;
  readonly rowApprovalOptions = ROW_APPROVAL_LEVEL_OPTIONS;

  // ---- Cột hiển thị cho AdminGridTable ----
  readonly columns = computed<GridColumn[]>(() => [
    {
      key: 'employeeCode',
      label: 'MÃ NV',
      type: 'code',
      align: 'center',
      width: '7.5rem',
      sortable: true,
      mono: true,
    },
    {
      key: 'fullName',
      label: 'HỌ VÀ TÊN',
      type: 'text',
      align: 'left',
      width: '14rem',
      sortable: true,
      bold: true,
    },
    {
      key: 'position',
      label: 'CHỨC VỤ / VỊ TRÍ',
      type: 'text',
      align: 'left',
      width: '12.5rem',
      sortable: true,
    },
    {
      key: 'branchName',
      label: 'CHI NHÁNH',
      type: 'pill',
      align: 'left',
      width: '11.5rem',
      sortable: true,
    },
    {
      key: 'roles',
      label: 'QUYỀN HẠN (VAI TRÒ)',
      align: 'left',
      width: '18rem',
      editable: true,
    },
    {
      key: 'approvalLevel',
      label: 'CẤP DUYỆT (APPROVAL LEVEL)',
      align: 'center',
      width: '15.5rem',
      editable: true,
    },
  ]);

  // ---- Danh sách hiển thị sau khi lọc Client ----
  readonly filteredEmployees = computed<EmployeePermissionSettingItem[]>(() => {
    const list = this.employeeList();
    const branchId = this.branchService.selectedBranchId();
    const lvl = this.levelFilter();
    const q = this.searchQuery().toLowerCase().trim();

    return list.filter((emp) => {
      // 1. Lọc theo chi nhánh
      if (branchId && branchId !== 'all') {
        const branchNum = Number(branchId);
        if (emp.branchId !== branchNum) {
          return false;
        }
      }

      // 2. Lọc theo cấp duyệt
      if (lvl !== 'all') {
        const lvlNum = Number(lvl);
        if (emp.approvalLevel !== lvlNum) {
          return false;
        }
      }

      // 3. Tìm kiếm theo mã, họ tên, chức vụ, username, vai trò
      if (q) {
        const matchCode = (emp.employeeCode || '').toLowerCase().includes(q);
        const matchName = (emp.fullName || '').toLowerCase().includes(q);
        const matchPos = (emp.position || '').toLowerCase().includes(q);
        const matchUser = (emp.username || '').toLowerCase().includes(q);
        const matchRoles = (emp.roleNames || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchPos && !matchUser && !matchRoles) {
          return false;
        }
      }

      return true;
    });
  });

  // ---- Chuyển đổi thành GridRow cho AdminGridTable ----
  readonly tableRows = computed<GridRow[]>(() => {
    return this.filteredEmployees().map((emp) => ({
      id: emp.employeeId,
      employeeId: emp.employeeId,
      employeeCode: emp.employeeCode,
      code: emp.employeeCode,
      fullName: emp.fullName,
      position: emp.position || '—',
      branchName: emp.branchName || 'Toàn hệ thống',
      roles: emp.roleNames || '',
      roleNames: emp.roleNames || '',
      approvalLevel: emp.approvalLevel,
      approvalLevelName: emp.approvalLevelName,
      _raw: emp,
    }));
  });

  // ---- Quản lý Modal Phân Quyền (Dấu +) & Ma trận 15 Permissions ----
  readonly isRoleModalOpen = signal(false);
  readonly isModalLoading = signal(false);
  readonly isSavingRoles = signal(false);
  readonly targetEmployee = signal<EmployeePermissionSettingItem | null>(null);
  readonly modalRoles = signal<RoleModalItem[]>([]);
  readonly selectedRoleIds = signal<number[]>([]);
  readonly allPermissions = signal<PermissionItem[]>([]);
  readonly rolePermMappings = signal<RolePermissionMapping[]>([]);

  readonly effectivePermissionCodes = computed<Set<string>>(() => {
    const selected = new Set(this.selectedRoleIds());
    const active = new Set<string>();
    for (const m of this.rolePermMappings()) {
      if (selected.has(m.roleId)) {
        active.add(m.permissionCode);
      }
    }
    return active;
  });

  readonly permissionModuleGroups = computed<{ moduleName: string; items: PermissionItem[] }[]>(() => {
    const perms = this.allPermissions();
    const groups: { moduleName: string; items: PermissionItem[] }[] = [];
    for (const p of perms) {
      let g = groups.find((x) => x.moduleName === p.moduleName);
      if (!g) {
        g = { moduleName: p.moduleName, items: [] };
        groups.push(g);
      }
      g.items.push(p);
    }
    return groups;
  });

  // Trạng thái cập nhật nhanh cấp duyệt trên dòng
  readonly updatingEmployeeIds = signal<Record<number, boolean>>({});

  constructor() {
    this.loadData();
    this.employeeApi.getRolePermissionMatrix().subscribe((matrix) => {
      this.allPermissions.set(matrix.permissions || []);
      this.rolePermMappings.set(matrix.mappings || []);
    });

    // Tự động tải lại khi đổi chi nhánh từ Topbar
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadData();
      });
    });
  }

  loadData(): void {
    this.isLoading.set(true);

    const bId = this.branchService.selectedBranchId();
    const branchIdParam = bId && bId !== 'all' ? Number(bId) : undefined;
    const lvl = this.levelFilter();
    const lvlParam = lvl !== 'all' ? Number(lvl) : undefined;

    this.employeeApi
      .getPermissionMatrix({
        branchId: branchIdParam,
        search: this.searchQuery(),
        approvalLevel: lvlParam,
      })
      .subscribe({
        next: (items) => {
          this.employeeList.set(items);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Lỗi khi tải bảng phân quyền & cấp duyệt:', err);
          this.toastService.error('Không thể nạp dữ liệu phân quyền từ hệ thống.');
          this.isLoading.set(false);
        },
      });
  }

  onGridRowClick(row: GridRow): void {
    const raw = row['_raw'] as EmployeePermissionSettingItem | undefined;
    const empId = raw?.employeeId || Number(row['employeeId'] || row['id']);
    if (!empId) return;

    const current = this.selectedEmployeeIds();
    if (current.includes(empId)) {
      this.selectedEmployeeIds.set(current.filter((id) => id !== empId));
    } else {
      this.selectedEmployeeIds.set([...current, empId]);
    }
  }

  clearSelection(): void {
    this.selectedEmployeeIds.set([]);
  }

  isAllSelected(): boolean {
    const rows = this.filteredEmployees();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeIds());
    return rows.every((r) => selected.has(r.employeeId));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedEmployeeIds.set(this.filteredEmployees().map((r) => r.employeeId));
    }
  }

  onBulkApprovalLevelChange(val: string): void {
    this.bulkApprovalLevel.set(val);
  }

  applyBulkApprovalLevel(): void {
    const ids = this.selectedEmployeeIds();
    if (ids.length === 0 || this.isBulkUpdatingLevel()) return;

    const newLevel = Number(this.bulkApprovalLevel());
    const targets = this.employeeList().filter((e) => ids.includes(e.employeeId));
    if (targets.length === 0) return;

    this.isBulkUpdatingLevel.set(true);

    const requests = targets.map((emp) =>
      this.employeeApi.updateEmployeeApprovalLevel(emp.employeeId, newLevel, emp.branchId)
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.isBulkUpdatingLevel.set(false);
        const levelName = newLevel === 0 ? 'Không có quyền duyệt' : `Cấp duyệt ${newLevel}`;
        const idSet = new Set(ids);

        this.employeeList.update((list) =>
          list.map((item) =>
            idSet.has(item.employeeId)
              ? { ...item, approvalLevel: newLevel, approvalLevelName: levelName }
              : item
          )
        );

        this.toastService.success(
          `Đã cập nhật cấp duyệt (${levelName}) cho ${targets.length} nhân sự!`
        );
        this.clearSelection();
      },
      error: () => {
        this.isBulkUpdatingLevel.set(false);
        this.toastService.error('Có lỗi xảy ra khi cập nhật cấp duyệt hàng loạt.');
      },
    });
  }

  // =========================================================================
  // XỬ LÝ THAY ĐỔI CẤP DUYỆT TRỰC TIẾP TỪ COMBOBOX TRÊN DÒNG
  // =========================================================================
  onApprovalLevelChange(rowOrEmp: any, event: Event): void {
    const emp: EmployeePermissionSettingItem = rowOrEmp?._raw || rowOrEmp;
    if (!emp || !emp.employeeId) return;

    const selectEl = event.target as HTMLSelectElement;
    const newLevel = Number(selectEl.value);

    if (newLevel === emp.approvalLevel) return;

    this.updatingEmployeeIds.update((curr) => ({ ...curr, [emp.employeeId]: true }));

    this.employeeApi
      .updateEmployeeApprovalLevel(emp.employeeId, newLevel, emp.branchId)
      .subscribe({
        next: () => {
          this.updatingEmployeeIds.update((curr) => {
            const copy = { ...curr };
            delete copy[emp.employeeId];
            return copy;
          });

          const levelName =
            newLevel === 0
              ? 'Không có quyền duyệt'
              : `Cấp ${newLevel}`;

          this.employeeList.update((list) =>
            list.map((item) =>
              item.employeeId === emp.employeeId
                ? { ...item, approvalLevel: newLevel, approvalLevelName: levelName }
                : item
            )
          );

          this.toastService.success(
            `Đã cập nhật [${emp.fullName}] thành: ${levelName} thành công!`
          );
          this.loadData();
        },
        error: (err) => {
          this.updatingEmployeeIds.update((curr) => {
            const copy = { ...curr };
            delete copy[emp.employeeId];
            return copy;
          });
          selectEl.value = String(emp.approvalLevel);
          this.toastService.error(err?.error?.message || 'Có lỗi xảy ra khi cập nhật cấp duyệt.');
        },
      });
  }

  // =========================================================================
  // XỬ LÝ MODAL CHỌN QUYỀN (DẤU +)
  // =========================================================================
  openRoleModal(rowOrEmp: any, event?: Event): void {
    event?.stopPropagation();
    const emp: EmployeePermissionSettingItem = rowOrEmp?._raw || rowOrEmp;
    if (!emp) return;

    this.targetEmployee.set(emp);
    this.isRoleModalOpen.set(true);
    this.isModalLoading.set(true);

    this.employeeApi.getEmployeeRolesForModal(emp.employeeId).subscribe({
      next: (roles) => {
        this.modalRoles.set(roles);
        const assignedIds = roles.filter((r) => r.isAssigned).map((r) => r.roleId);
        this.selectedRoleIds.set(assignedIds);
        this.isModalLoading.set(false);
      },
      error: () => {
        this.toastService.error('Không thể nạp danh sách vai trò hệ thống.');
        this.isModalLoading.set(false);
      },
    });
  }

  closeRoleModal(): void {
    if (this.isSavingRoles()) return;
    this.isRoleModalOpen.set(false);
    this.targetEmployee.set(null);
    this.modalRoles.set([]);
    this.selectedRoleIds.set([]);
  }

  toggleRoleSelection(roleId: number): void {
    const current = this.selectedRoleIds();
    if (current.includes(roleId)) {
      this.selectedRoleIds.set(current.filter((id) => id !== roleId));
    } else {
      this.selectedRoleIds.set([...current, roleId]);
    }
  }

  isRoleSelected(roleId: number): boolean {
    return this.selectedRoleIds().includes(roleId);
  }

  saveRoles(): void {
    const emp = this.targetEmployee();
    if (!emp) return;

    this.isSavingRoles.set(true);
    const roleIdsStr = this.selectedRoleIds().join(',');

    this.employeeApi.assignRolesToEmployee(emp.employeeId, roleIdsStr).subscribe({
      next: (res) => {
        this.isSavingRoles.set(false);
        this.toastService.success(
          res.message || `Đã cập nhật phân quyền cho nhân sự [${emp.fullName}] thành công!`
        );

        const selectedIdsSet = new Set(this.selectedRoleIds());
        const selectedRoleNames = this.modalRoles()
          .filter((r) => selectedIdsSet.has(r.roleId))
          .map((r) => r.roleName)
          .join(', ');

        this.employeeList.update((list) =>
          list.map((item) =>
            item.employeeId === emp.employeeId
              ? {
                  ...item,
                  roleNames: selectedRoleNames,
                  roleIds: roleIdsStr,
                }
              : item
          )
        );

        this.closeRoleModal();
      },
      error: (err) => {
        this.isSavingRoles.set(false);
        const msg = err?.error?.message || 'Có lỗi xảy ra khi cập nhật vai trò phân quyền.';
        this.toastService.error(msg);
      },
    });
  }

  // =========================================================================
  // HELPER FORMAT & HIỂN THỊ
  // =========================================================================
  getRoleList(roleNames: string | undefined): string[] {
    if (!roleNames) return [];
    return roleNames
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
  }

  getRoleDisplayLabel(roleName: string): string {
    switch ((roleName || '').trim()) {
      case 'Admin':
        return 'Quản trị hệ thống';
      case 'HRManager':
        return 'Nhân sự & Tiền lương';
      case 'StoreManager':
        return 'Quản lý chi nhánh';
      case 'ShiftLeader':
        return 'Trưởng ca vận hành';
      case 'Accountant':
        return 'Kế toán & Kho';
      case 'Cashier':
        return 'Thu ngân POS';
      case 'ServiceStaff':
        return 'Phục vụ (Order & Ca)';
      case 'Barista':
        return 'Pha chế (Quầy & Ca)';
      default:
        return roleName;
    }
  }

  getRoleBadgeClass(roleName: string): string {
    const r = roleName.toLowerCase();
    if (r.includes('admin') || r.includes('giám đốc')) return 'role-pill-red';
    if (r.includes('hrm') || r.includes('nhân sự')) return 'role-pill-blue';
    if (r.includes('manager') || r.includes('quản lý') || r.includes('cửa hàng trưởng')) return 'role-pill-amber';
    if (r.includes('cashier') || r.includes('thu ngân')) return 'role-pill-emerald';
    if (r.includes('leader') || r.includes('trưởng ca')) return 'role-pill-cyan';
    if (r.includes('accountant') || r.includes('kế toán')) return 'role-pill-indigo';
    if (r.includes('service') || r.includes('phục vụ')) return 'role-pill-amber';
    return 'role-pill-gray';
  }

  getLevelBadgeClass(level: number): string {
    switch (level) {
      case 5:
        return 'level-badge-5';
      case 4:
        return 'level-badge-4';
      case 3:
        return 'level-badge-3';
      case 2:
        return 'level-badge-2';
      case 1:
        return 'level-badge-1';
      default:
        return 'level-badge-0';
    }
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
  }

  onBranchFilterChange(value: string): void {
    this.branchService.selectBranch(value);
  }

  onLevelFilterChange(value: string): void {
    this.levelFilter.set(value);
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.levelFilter.set('all');
    this.branchService.selectBranch('all');
    this.loadData();
    this.toastService.success('Đã làm mới ma trận phân quyền & cấp duyệt!');
  }
}
