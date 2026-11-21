import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  LucideCalendarDays,
  LucideCheck,
  LucidePlus,
  LucideRotateCcw,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import {
  HolidayItem,
  HrmEmployeeApi,
  LeaveTypeItem,
  OvertimeTypeItem,
} from '../../../services/hrm_employee_api';

type SettingsSection = 'ot' | 'leave';

export interface EditableOvertimeRow extends OvertimeTypeItem {
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

export interface EditableLeaveRow extends LeaveTypeItem {
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

@Component({
  selector: 'app-attendance-settings',
  templateUrl: './attendance_settings.html',
  styleUrl: './attendance_settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCalendarDays,
    LucideCheck,
    LucidePlus,
    LucideRotateCcw,
    LucideTrash2,
    LucideX,
    AdminModal,
    AdminButtonComponent,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
  ],
})
export class AttendanceSettings implements OnInit {
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);
  private localSeq = 0;

  // ---- Điều hướng & Bộ lọc ----
  readonly activeSection = signal<SettingsSection>('ot');
  readonly selectedScope = signal<string>('all');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly scopeOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả khối' },
    { value: 'store', label: 'Quán cà phê' },
    { value: 'office', label: 'Khối văn phòng' },
  ];

  // ---- Dữ liệu bảng có thể sửa trực tiếp ----
  readonly otRows = signal<EditableOvertimeRow[]>([]);
  readonly leaveRows = signal<EditableLeaveRow[]>([]);
  readonly holidays = signal<HolidayItem[]>([]);
  readonly holidayYear = new Date().getFullYear();

  readonly filteredOtRows = computed(() => {
    const scope = this.selectedScope();
    const kw = this.searchQuery().trim().toLowerCase();
    return this.otRows().filter((item) => {
      if (item._isNew) return true;
      const matchScope = scope === 'all' || item.scope === scope || item.scope === 'all';
      const matchKw =
        !kw ||
        item.otCode.toLowerCase().includes(kw) ||
        item.otName.toLowerCase().includes(kw);
      return matchScope && matchKw;
    });
  });

  readonly filteredLeaveRows = computed(() => {
    const scope = this.selectedScope();
    const kw = this.searchQuery().trim().toLowerCase();
    return this.leaveRows().filter((item) => {
      if (item._isNew) return true;
      const matchScope = scope === 'all' || item.scope === scope || item.scope === 'all';
      const matchKw =
        !kw ||
        item.leaveCode.toLowerCase().includes(kw) ||
        item.leaveName.toLowerCase().includes(kw);
      return matchScope && matchKw;
    });
  });

  readonly dirtyOtCount = computed(() => this.otRows().filter((r) => r._isDirty).length);
  readonly dirtyLeaveCount = computed(() => this.leaveRows().filter((r) => r._isDirty).length);
  readonly totalDirtyCount = computed(() => this.dirtyOtCount() + this.dirtyLeaveCount());

  // ---- Modal xác nhận xóa ----
  readonly deleteTarget = signal<{
    type: SettingsSection;
    localKey: string;
    id: number;
    isNew: boolean;
    code: string;
    name: string;
  } | null>(null);

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.employeeApi.getOvertimeTypes().subscribe({
      next: (items) => {
        this.otRows.set(
          items.map((item) => ({
            ...item,
            _localKey: `ot-${item.overtimeTypeId}`,
            _isDirty: false,
            _isNew: false,
          }))
        );
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.toastService.error(err.message);
      },
    });

    this.employeeApi.getLeaveTypes().subscribe({
      next: (items) => {
        this.leaveRows.set(
          items.map((item) => ({
            ...item,
            _localKey: `lv-${item.leaveTypeId}`,
            _isDirty: false,
            _isNew: false,
          }))
        );
      },
      error: (err: Error) => this.toastService.error(err.message),
    });

    this.employeeApi.getHolidaysByYear(this.holidayYear).subscribe({
      next: (items) => this.holidays.set(items),
      error: () => this.holidays.set([]),
    });
  }

  refresh(): void {
    this.searchQuery.set('');
    this.selectedScope.set('all');
    this.loadAll();
    this.toastService.success('Đã tải lại dữ liệu mới nhất từ cơ sở dữ liệu.');
  }

  // ---- Thêm dòng mới trực tiếp vào bảng ----
  addNewRow(): void {
    this.localSeq += 1;
    if (this.activeSection() === 'ot') {
      const newRow: EditableOvertimeRow = {
        overtimeTypeId: 0,
        otCode: '',
        otName: '',
        otCategory: 'normal',
        scope: this.selectedScope() === 'all' ? 'all' : this.selectedScope(),
        payMultiplier: 150,
        nightExtraRate: 0,
        maxHoursPerDay: 4,
        maxHoursPerMonth: 40,
        roundingMinutes: 15,
        requireApproval: true,
        allowCompensatoryLeave: false,
        description: '',
        isActive: true,
        _localKey: `ot-new-${this.localSeq}`,
        _isDirty: true,
        _isNew: true,
      };
      this.otRows.update((rows) => [newRow, ...rows]);
    } else {
      const newRow: EditableLeaveRow = {
        leaveTypeId: 0,
        leaveCode: '',
        leaveName: '',
        scope: this.selectedScope() === 'all' ? 'all' : this.selectedScope(),
        isPaid: true,
        paidPercent: 100,
        deductAnnualLeave: false,
        standardDaysPerYear: 0,
        minNoticeDays: 1,
        monthlyAccrual: false,
        probationEligible: false,
        allowNegativeBalance: false,
        description: '',
        isActive: true,
        _localKey: `lv-new-${this.localSeq}`,
        _isDirty: true,
        _isNew: true,
      };
      this.leaveRows.update((rows) => [newRow, ...rows]);
    }
  }

  // ---- Đánh dấu dòng đã thay đổi ----
  markOtDirty(row: EditableOvertimeRow): void {
    row._isDirty = true;
    this.otRows.update((rows) => [...rows]);
  }

  markLeaveDirty(row: EditableLeaveRow): void {
    if (!row.isPaid) {
      row.paidPercent = 0;
    } else if (row.paidPercent === 0) {
      row.paidPercent = 100;
    }
    row._isDirty = true;
    this.leaveRows.update((rows) => [...rows]);
  }

  // ---- Lưu toàn bộ dòng đã sửa ----
  saveAllChanges(): void {
    if (this.isSaving() || this.totalDirtyCount() === 0) return;

    const dirtyOts = this.otRows().filter((r) => r._isDirty);
    const dirtyLeaves = this.leaveRows().filter((r) => r._isDirty);

    for (const r of dirtyOts) {
      if (!r.otCode.trim() || !r.otName.trim()) {
        this.activeSection.set('ot');
        this.toastService.warning('Vui lòng nhập đầy đủ Mã OT và Tên loại tăng ca cho các dòng mới/đang sửa.');
        return;
      }
    }

    for (const r of dirtyLeaves) {
      if (!r.leaveCode.trim() || !r.leaveName.trim()) {
        this.activeSection.set('leave');
        this.toastService.warning('Vui lòng nhập đầy đủ Mã phép và Tên loại nghỉ phép cho các dòng mới/đang sửa.');
        return;
      }
    }

    const calls = [
      ...dirtyOts.map((r) =>
        this.employeeApi.saveOvertimeType({
          overtimeTypeId: r._isNew ? null : r.overtimeTypeId,
          otCode: r.otCode.trim().toUpperCase(),
          otName: r.otName.trim(),
          otCategory: r.otCategory,
          scope: r.scope,
          payMultiplier: Number(r.payMultiplier) || 100,
          nightExtraRate: Number(r.nightExtraRate) || 0,
          maxHoursPerDay: Number(r.maxHoursPerDay) || 1,
          maxHoursPerMonth: Number(r.maxHoursPerMonth) || 1,
          roundingMinutes: Number(r.roundingMinutes) || 15,
          requireApproval: r.requireApproval,
          allowCompensatoryLeave: r.allowCompensatoryLeave,
          description: r.description?.trim() || null,
          isActive: r.isActive,
        })
      ),
      ...dirtyLeaves.map((r) =>
        this.employeeApi.saveLeaveType({
          leaveTypeId: r._isNew ? null : r.leaveTypeId,
          leaveCode: r.leaveCode.trim().toUpperCase(),
          leaveName: r.leaveName.trim(),
          scope: r.scope,
          isPaid: r.isPaid,
          paidPercent: r.isPaid ? Number(r.paidPercent) || 0 : 0,
          deductAnnualLeave: r.deductAnnualLeave,
          standardDaysPerYear: Number(r.standardDaysPerYear) || 0,
          minNoticeDays: Number(r.minNoticeDays) || 0,
          monthlyAccrual: r.monthlyAccrual,
          probationEligible: r.probationEligible,
          allowNegativeBalance: r.allowNegativeBalance,
          description: r.description?.trim() || null,
          isActive: r.isActive,
        })
      ),
    ];

    this.isSaving.set(true);
    forkJoin(calls).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.success(`Đã lưu thành công ${calls.length} thay đổi vào cơ sở dữ liệu!`);
        this.loadAll();
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.toastService.error(err.message);
      },
    });
  }

  discardChanges(): void {
    this.loadAll();
    this.toastService.info('Đã hủy các thay đổi chưa lưu.');
  }

  // ---- Xóa dòng ----
  confirmDeleteOt(row: EditableOvertimeRow): void {
    if (row._isNew) {
      this.otRows.update((rows) => rows.filter((r) => r._localKey !== row._localKey));
      return;
    }
    this.deleteTarget.set({
      type: 'ot',
      localKey: row._localKey,
      id: row.overtimeTypeId,
      isNew: false,
      code: row.otCode,
      name: row.otName,
    });
  }

  confirmDeleteLeave(row: EditableLeaveRow): void {
    if (row._isNew) {
      this.leaveRows.update((rows) => rows.filter((r) => r._localKey !== row._localKey));
      return;
    }
    this.deleteTarget.set({
      type: 'leave',
      localKey: row._localKey,
      id: row.leaveTypeId,
      isNew: false,
      code: row.leaveCode,
      name: row.leaveName,
    });
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.isSaving()) return;

    this.isSaving.set(true);
    const req$ =
      target.type === 'ot'
        ? this.employeeApi.deleteOvertimeType(target.id)
        : this.employeeApi.deleteLeaveType(target.id);

    req$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.deleteTarget.set(null);
        this.toastService.success(`Đã xóa mã ${target.code}.`);
        this.loadAll();
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.toastService.error(err.message);
      },
    });
  }
}
