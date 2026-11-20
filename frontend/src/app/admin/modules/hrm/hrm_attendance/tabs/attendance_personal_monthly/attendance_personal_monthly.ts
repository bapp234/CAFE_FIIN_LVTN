import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDownload, LucideEdit, LucideRotateCcw } from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminFormField } from '../../../../../shared/admin_form_field/admin_form_field';
import { AdminDrawer } from '../../../../../shared/admin_drawer/admin_drawer';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
  GridSort,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { Employee } from '../../../models/employee';
import { HrmEmployeeApi } from '../../../services/hrm_employee_api';
import { getCurrentMonthRange } from '../../../utils/hrm_date_helpers';

@Component({
  selector: 'app-attendance-personal-monthly',
  templateUrl: './attendance_personal_monthly.html',
  styleUrl: './attendance_personal_monthly.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideDownload,
    LucideEdit,
    LucideRotateCcw,
    AdminFormField,
    AdminDrawer,
    AdminModal,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class AttendancePersonalMonthly {
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);
  private readonly route = inject(ActivatedRoute);

  // ---- Bộ lọc & Chọn Nhân sự / Khoảng ngày lọc ----
  readonly selectedEmployeeCode = signal<string>('');
  readonly fromDate = signal<string>(getCurrentMonthRange().fromDate);
  readonly toDate = signal<string>(getCurrentMonthRange().toDate);
  readonly statusFilter = signal<string>('all');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);

  // ---- Danh sách nhân sự & Bản ghi điều chỉnh tay ----
  readonly employees = signal<Employee[]>([]);
  readonly manualOverrides = signal<
    Record<string, { checkIn: string; checkOut: string; note: string }>
  >({});

  // ---- Drawer sửa giờ chấm công ----
  readonly isAdjustDrawerOpen = signal(false);
  readonly adjustingRow = signal<GridRow | null>(null);

  readonly adjustForm = new FormGroup({
    checkIn: new FormControl('06:30', { nonNullable: true, validators: [Validators.required] }),
    checkOut: new FormControl('14:30', { nonNullable: true, validators: [Validators.required] }),
    quickReason: new FormControl(''),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5)],
    }),
  });

  // ---- Tùy chọn Combobox ----
  readonly employeeOptions = computed<ComboOption[]>(() =>
    this.employees().map((e) => ({
      value: e.code,
      label: `${e.code} - ${e.fullName}`,
    }))
  );

  readonly selectedEmployee = computed<Employee | null>(
    () => this.employees().find((e) => e.code === this.selectedEmployeeCode()) ?? null
  );

  readonly statusFilterOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'on_time', label: 'Đúng giờ' },
    { value: 'late', label: 'Đi muộn' },
    { value: 'leave', label: 'Nghỉ phép' },
    { value: 'off', label: 'Nghỉ tuần' },
  ];

  // =========================================================================
  // CỘT BẢNG CÔNG CÁ NHÂN (ĐÃ BỎ CỘT THỨ, CHỈ ĐỂ LẠI CỘT NGÀY)
  // =========================================================================
  readonly personalColumns: GridColumn[] = [
    { key: 'displayDate', label: 'Ngày', type: 'code', width: '7.5rem', sortable: true },
    {
      key: 'shiftLabel',
      label: 'Ca đăng ký',
      type: 'pill',
      minWidth: '13rem',
      sortable: true,
    },
    {
      key: 'checkIn',
      label: 'Giờ vào thực tế',
      type: 'text',
      align: 'center',
      mono: true,
      bold: true,
      width: '8.5rem',
    },
    {
      key: 'checkOut',
      label: 'Giờ ra thực tế',
      type: 'text',
      align: 'center',
      mono: true,
      bold: true,
      width: '8.5rem',
    },
    {
      key: 'lateMinutes',
      label: 'Đi muộn',
      type: 'number',
      align: 'right',
      width: '6.5rem',
      suffix: ' phút',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'workHours',
      label: 'Giờ công',
      type: 'number',
      align: 'right',
      width: '6.75rem',
      bold: true,
      tone: 'success',
      suffix: 'h',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'overtimeHours',
      label: 'Tăng ca (OT)',
      type: 'number',
      align: 'right',
      width: '7rem',
      tone: 'info',
      suffix: 'h',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'status',
      label: 'Đối chiếu lịch',
      type: 'badge',
      align: 'center',
      width: '8.5rem',
      sortable: true,
      badgeMap: {
        on_time: { label: 'Đúng giờ', variant: 'success' },
        late: { label: 'Đi muộn', variant: 'warning' },
        leave: { label: 'Nghỉ phép (P)', variant: 'info' },
        off: { label: 'Nghỉ lịch tuần', variant: 'neutral' },
      },
    },
    {
      key: 'note',
      label: 'Ghi chú / Kiểm toán',
      type: 'text',
      minWidth: '13rem',
      tone: 'muted',
    },
  ];

  // =========================================================================
  // DÒNG DỮ LIỆU CHẤM CÔNG THEO KHOẢNG NGÀY LỌC (TỪ NGÀY -> ĐẾN NGÀY)
  // =========================================================================
  readonly personalRows = computed<GridRow[]>(() => {
    const emp = this.selectedEmployee();
    if (!emp) return [];

    const fromStr = this.fromDate();
    const toStr = this.toDate();
    if (!fromStr || !toStr) return [];

    const fromDateObj = new Date(fromStr);
    const toDateObj = new Date(toStr);
    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime()) || fromDateObj > toDateObj) {
      return [];
    }

    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const overrides = this.manualOverrides();
    const sf = this.statusFilter();

    const rows: GridRow[] = [];
    const current = new Date(fromDateObj);

    while (current <= toDateObj) {
      const y = current.getFullYear();
      const m = current.getMonth() + 1;
      const day = current.getDate();
      const dow = current.getDay();

      const dd = String(day).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const dateIso = `${y}-${mm}-${dd}`;
      const displayDate = `${dd}/${mm}/${y}`;
      const dayOfWeek = dayNames[dow];

      const overrideKey = `${emp.code}_${dateIso}`;
      const ov = overrides[overrideKey];

      let shiftLabel = 'CA-SANG (06:30–14:30)';
      let checkIn = '06:28';
      let checkOut = '14:32';
      let lateMinutes = 0;
      let workHours = 7.5;
      let overtimeHours = 0;
      let status = 'on_time';
      let note = 'Quét vân tay chuẩn';

      if (dow === 0) {
        shiftLabel = 'Nghỉ định kỳ';
        checkIn = '—';
        checkOut = '—';
        workHours = 0;
        status = 'off';
        note = 'Nghỉ Chủ Nhật';
      } else if (day === 12) {
        shiftLabel = 'Nghỉ phép năm (P)';
        checkIn = '—';
        checkOut = '—';
        workHours = 7.5;
        status = 'leave';
        note = 'Đơn xin nghỉ phép đã duyệt';
      } else if (day % 9 === 0) {
        checkIn = '06:44';
        lateMinutes = 14;
        status = 'late';
        note = 'Quét vân tay trễ 14 phút';
      } else if (day % 6 === 0) {
        overtimeHours = 2;
        checkOut = '16:30';
        note = 'Tăng ca hỗ trợ ca chiều';
      }

      if (ov) {
        checkIn = ov.checkIn;
        checkOut = ov.checkOut;
        lateMinutes = 0;
        workHours = 7.5;
        status = 'on_time';
        note = `Đã sửa thủ công: ${ov.note}`;
      }

      if (sf === 'all' || status === sf) {
        rows.push({
          dateIso,
          displayDate,
          dayOfWeek,
          shiftLabel,
          checkIn,
          checkOut,
          lateMinutes,
          workHours,
          overtimeHours,
          status,
          note,
        });
      }

      // Tăng thêm 1 ngày
      current.setDate(current.getDate() + 1);
    }

    return rows;
  });

  constructor() {
    this.route.queryParams.subscribe((params) => {
      if (params['emp']) {
        this.selectedEmployeeCode.set(String(params['emp']));
      }
      if (params['fromDate']) {
        this.fromDate.set(String(params['fromDate']));
      }
      if (params['toDate']) {
        this.toDate.set(String(params['toDate']));
      }
      if (params['month'] && params['year']) {
        const y = String(params['year']);
        const m = String(params['month']).padStart(2, '0');
        const lastDay = new Date(Number(y), Number(m), 0).getDate();
        this.fromDate.set(`${y}-${m}-01`);
        this.toDate.set(`${y}-${m}-${lastDay}`);
      }
    });

    this.loadEmployeesList();
  }

  loadEmployeesList(): void {
    this.isLoading.set(true);

    this.employeeApi
      .getEmployees({ page: 1, size: 100, branchId: 'all', status: 'working' })
      .subscribe({
        next: (res) => {
          this.employees.set(res.items);
          const currentCode = this.selectedEmployeeCode();
          if (!currentCode && res.items.length > 0) {
            this.selectedEmployeeCode.set(res.items[0].code);
          }
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onEmployeeSelectChange(code: string): void {
    this.selectedEmployeeCode.set(code);
  }

  onFromDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.fromDate.set(val);
    }
  }

  onToDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.toDate.set(val);
    }
  }

  onStatusFilterChange(st: string): void {
    this.statusFilter.set(st);
  }

  onSortChange(sort: GridSort): void {
    this.sortBy.set(sort.key);
    this.sortOrder.set(sort.order);
  }

  refreshTab(): void {
    const range = getCurrentMonthRange();
    this.statusFilter.set('all');
    this.fromDate.set(range.fromDate);
    this.toDate.set(range.toDate);
    this.loadEmployeesList();
    this.toastService.success('Đã làm mới bảng công cá nhân!');
  }

  // =========================================================================
  // ĐIỀU CHỈNH GIỜ CHẤM CÔNG THỦ CÔNG
  // =========================================================================
  openAdjustModal(row: GridRow): void {
    this.adjustingRow.set(row);
    this.adjustForm.reset({
      checkIn: row['checkIn'] !== '—' ? String(row['checkIn']) : '06:30',
      checkOut: row['checkOut'] !== '—' ? String(row['checkOut']) : '14:30',
      quickReason: '',
      reason: '',
    });
    this.isAdjustDrawerOpen.set(true);
  }

  onQuickReasonSelect(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val) {
      this.adjustForm.patchValue({ reason: val });
    }
  }

  saveAdjust(): void {
    if (this.adjustForm.invalid) {
      this.adjustForm.markAllAsTouched();
      this.toastService.error('Vui lòng nhập đầy đủ giờ vào/ra và lý do điều chỉnh!');
      return;
    }

    const row = this.adjustingRow();
    const emp = this.selectedEmployee();
    if (!row || !emp) return;

    const val = this.adjustForm.getRawValue();
    const dateIso = String(row['dateIso']);
    const checkInDt = `${dateIso}T${val.checkIn}:00`;
    const checkOutDt = `${dateIso}T${val.checkOut}:00`;
    const empId = Number((emp as unknown as { employeeId?: number }).employeeId || emp.id || 0);

    if (empId > 0) {
      this.employeeApi
        .adjustAttendanceManual({
          employeeId: empId,
          workDate: dateIso,
          checkInTime: checkInDt,
          checkOutTime: checkOutDt,
          adjustedBy: 'Quản trị viên HRM',
          adjustedReason: val.reason,
        })
        .subscribe({
          next: () => {
            const key = `${emp.code}_${dateIso}`;
            this.manualOverrides.update((curr) => ({
              ...curr,
              [key]: {
                checkIn: val.checkIn,
                checkOut: val.checkOut,
                note: val.reason,
              },
            }));
            this.isAdjustDrawerOpen.set(false);
            this.toastService.success(
              `Đã lưu điều chỉnh giờ công ngày ${row['displayDate']} cho ${emp.fullName} (Audit Trail)!`
            );
          },
          error: (err) => {
            const msg = err?.error?.message || 'Không thể điều chỉnh giờ công (kiểm tra trạng thái khóa kỳ công).';
            this.toastService.error(msg);
          },
        });
      return;
    }

    const key = `${emp.code}_${dateIso}`;
    this.manualOverrides.update((curr) => ({
      ...curr,
      [key]: {
        checkIn: val.checkIn,
        checkOut: val.checkOut,
        note: val.reason,
      },
    }));

    this.isAdjustDrawerOpen.set(false);
    this.toastService.success(
      `Đã cập nhật giờ công ngày ${row['displayDate']} cho ${emp.fullName}!`
    );
  }

  openExportConfirm(): void {
    const emp = this.selectedEmployee();
    if (!emp || this.personalRows().length === 0) {
      this.toastService.warning('Không có dữ liệu bảng công cá nhân để xuất Excel.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportPersonalExcel(): void {
    const emp = this.selectedEmployee();
    const rows = this.personalRows();
    if (!emp || rows.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const headers = [
      'Ngày',
      'Ca đăng ký',
      'Giờ vào thực tế',
      'Giờ ra thực tế',
      'Đi muộn (phút)',
      'Giờ công',
      'Tăng ca (OT)',
      'Đối chiếu',
      'Ghi chú',
    ];

    const payloadRows = rows.map((r) => ({
      'Ngày': String(r['displayDate'] ?? ''),
      'Ca đăng ký': String(r['shiftLabel'] ?? ''),
      'Giờ vào thực tế': String(r['checkIn'] ?? ''),
      'Giờ ra thực tế': String(r['checkOut'] ?? ''),
      'Đi muộn (phút)': Number(r['lateMinutes'] ?? 0),
      'Giờ công': `${r['workHours'] ?? 0}h`,
      'Tăng ca (OT)': `${r['overtimeHours'] ?? 0}h`,
      'Đối chiếu': String(r['status'] ?? ''),
      'Ghi chú': String(r['note'] ?? ''),
    }));

    const fileName = `Fiin_HRM_Cong_Ca_Nhan_${emp.code}_${this.fromDate()}_${this.toDate()}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Attendance_Personal',
        sheetName: 'Công cá nhân',
        reportTitle: `BẢNG CÔNG CÁ NHÂN: ${emp.fullName} (${emp.code})`,
        summaryLabel: 'Tổng số ngày:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.isExportConfirmOpen.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất bảng công của ${emp.fullName} ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel bảng công cá nhân.');
        },
      });
  }
}
