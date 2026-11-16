import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAlertTriangle,
  LucideCalendar,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideDownload,
  LucideEdit,
  LucideFileSpreadsheet,
  LucideFileText,
  LucideInbox,
  LucidePrinter,
  LucideSearch,
  LucideUpload,
  LucideUsers,
} from '@lucide/angular';
import { SortDirection, TableColumn } from '../../../shared/models/page';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminPageHeader } from '../../../shared/admin_page_header/admin_page_header';
import { AdminStatusBadge, BadgeVariant } from '../../../shared/admin_status_badge/admin_status_badge';
import { AdminFormField } from '../../../shared/admin_form_field/admin_form_field';
import { AdminModal } from '../../../shared/admin_modal/admin_modal';
import { AdminSession } from '../../../core/admin_session';
import { AttendanceRecord } from '../models/attendance';
import { HrmAttendanceApi } from '../services/hrm_attendance_api';

@Component({
  selector: 'app-hrm-attendance',
  templateUrl: './hrm_attendance.html',
  styleUrl: './hrm_attendance.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideCalendar,
    LucideClock,
    LucideEdit,
    LucideUpload,
    LucideDownload,
    LucideFileText,
    LucideFileSpreadsheet,
    LucidePrinter,
    LucideSearch,
    LucideInbox,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCheck,
    LucideAlertTriangle,
    AdminPageHeader,
    AdminStatusBadge,
    AdminFormField,
    AdminModal,
  ],
})
export class HrmAttendance {
  readonly branchService = inject(AdminBranchService);
  private readonly attendanceApi = inject(HrmAttendanceApi);
  private readonly toastService = inject(AdminToastService);
  private readonly session = inject(AdminSession);

  readonly selectedDate = signal<string>('2026-11-15');
  readonly statusFilter = signal<string>('all');
  readonly searchQuery = signal<string>('');
  readonly page = signal<number>(1);
  readonly size = signal<number>(20);
  readonly total = signal<number>(0);
  readonly records = signal<AttendanceRecord[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isImporting = signal<boolean>(false);

  // Chọn dòng trong bảng lưới
  readonly selectedRecordId = signal<string | null>(null);
  readonly sortBy = signal<string>('code');
  readonly sortOrder = signal<SortDirection>('asc');

  // Summary Metrics
  readonly summary = signal({ scheduled: 0, onTime: 0, late: 0, absent: 0 });

  readonly totalWorkHours = computed(() => {
    const list = this.records();
    const sum = list.reduce((acc, r) => acc + (r.workHours || 0), 0);
    return Math.round(sum * 10) / 10;
  });

  readonly totalOtHours = computed(() => {
    const list = this.records();
    const sum = list.reduce((acc, r) => acc + (r.overtimeHours || 0), 0);
    return Math.round(sum * 10) / 10;
  });

  // Adjust Attendance Modal
  readonly isAdjustModalOpen = signal(false);
  readonly adjustingRecord = signal<AttendanceRecord | null>(null);

  readonly adjustForm = new FormGroup({
    checkIn: new FormControl('06:30', { nonNullable: true, validators: [Validators.required] }),
    checkOut: new FormControl('12:00', { nonNullable: true, validators: [Validators.required] }),
    quickReason: new FormControl(''),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] }),
  });

  readonly columns: TableColumn<AttendanceRecord>[] = [
    { key: 'employeeCode', label: 'Mã NV & Nhân sự', width: '15rem' },
    { key: 'branchName', label: 'Chi nhánh' },
    { key: 'scheduledShiftName', label: 'Ca đăng ký trước' },
    { key: 'checkIn', label: 'Giờ vào / ra thực tế' },
    { key: 'workHours', label: 'Giờ công & OT', align: 'right' },
    { key: 'status', label: 'Đối chiếu lịch' },
    { key: 'actions', label: 'Thao tác', align: 'center', width: '6rem' },
  ];

  constructor() {
    effect(() => {
      const branchId = this.branchService.selectedBranchId();
      this.page.set(1);
      this.loadAttendanceData();
    });
  }

  loadAttendanceData(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();

    this.attendanceApi.getTodayAttendanceSummary(branchId).subscribe((res) => {
      this.summary.set(res);
    });

    this.attendanceApi
      .getAttendanceList({
        page: this.page(),
        size: this.size(),
        date: this.selectedDate(),
        branchId,
        status: this.statusFilter(),
        q: this.searchQuery(),
      })
      .subscribe((res) => {
        this.records.set(res.items);
        this.total.set(res.total);
        this.isLoading.set(false);
      });
  }

  onDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.selectedDate.set(val);
      this.page.set(1);
      this.loadAttendanceData();
    }
  }

  stepDate(days: number): void {
    const cur = new Date(this.selectedDate());
    cur.setDate(cur.getDate() + days);
    this.selectedDate.set(cur.toISOString().split('T')[0]);
    this.page.set(1);
    this.loadAttendanceData();
  }

  setToday(): void {
    this.selectedDate.set('2026-11-15');
    this.page.set(1);
    this.loadAttendanceData();
  }

  onStatusFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(val);
    this.page.set(1);
    this.loadAttendanceData();
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
    this.page.set(1);
    this.loadAttendanceData();
  }

  onResetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.selectedDate.set('2026-11-15');
    this.page.set(1);
    this.loadAttendanceData();
  }

  selectRecord(rec: AttendanceRecord): void {
    this.selectedRecordId.set(rec.id);
  }

  onSortToggle(key: string): void {
    if (this.sortBy() === key) {
      this.sortOrder.update((curr) => (curr === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(key);
      this.sortOrder.set('asc');
    }
  }

  printAttendance(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  // =========================================================================
  // ĐIỀU CHỈNH GIỜ CHẤM CÔNG THỦ CÔNG
  // =========================================================================
  openAdjustModal(rec: AttendanceRecord, event?: Event): void {
    if (event) event.stopPropagation();
    this.adjustingRecord.set(rec);
    this.adjustForm.reset({
      checkIn: rec.checkIn || rec.scheduledStartTime || '06:30',
      checkOut: rec.checkOut || rec.scheduledEndTime || '12:00',
      quickReason: '',
      reason: rec.adjustedNote || '',
    });
    this.isAdjustModalOpen.set(true);
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

    const rec = this.adjustingRecord();
    if (!rec) return;

    const val = this.adjustForm.getRawValue();
    const adjuster = this.session.user()?.name || 'Quản lý cửa hàng';

    this.attendanceApi.adjustAttendance(rec.id, val.checkIn, val.checkOut, val.reason, adjuster).subscribe({
      next: (updated) => {
        this.toastService.success(`Đã cập nhật giờ chấm công cho ${updated.employeeName}`);
        this.isAdjustModalOpen.set(false);
        this.adjustingRecord.set(null);
        this.loadAttendanceData();
      },
      error: (err) => this.toastService.error(err.message),
    });
  }

  // =========================================================================
  // XUẤT EXCEL / CSV BÁO CÁO CHẤM CÔNG
  // =========================================================================
  exportCsv(): void {
    this.attendanceApi
      .exportCsv({
        page: 1,
        size: 1000,
        date: this.selectedDate(),
        branchId: this.branchService.selectedBranchId(),
      })
      .subscribe((csvContent) => {
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Bao_Cao_Cham_Cong_FiinCoffee_${this.selectedDate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.toastService.success('Đã xuất báo cáo chấm công ra tệp Excel (.csv) thành công!');
      });
  }

  // =========================================================================
  // TẢI FILE MẪU CHẤM CÔNG
  // =========================================================================
  downloadTemplate(): void {
    const headers = ['Mã NV', 'Họ và tên', 'Ngày (YYYY-MM-DD)', 'Giờ vào (HH:mm)', 'Giờ ra (HH:mm)', 'Ghi chú'];
    const rows = [
      ['NV001', '"Đặng Quốc Anh"', '2026-11-15', '06:25', '12:05', '"Quét vân tay máy cửa chính"'],
      ['NV002', '"Nguyễn Thị Hương"', '2026-11-15', '06:45', '12:00', '"Quét vân tay máy quầy bar"'],
      ['NV009', '"Ngô Thùy Trang"', '2026-11-15', '11:55', '18:30', '"Quét khuôn mặt máy ca chiều"'],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Template_Cham_Cong_May_Van_Tay.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.toastService.info('Đã tải tệp Excel mẫu dữ liệu chấm công.');
  }

  // =========================================================================
  // IMPORT DỮ LIỆU TỪ MÁY CHẤM CÔNG
  // =========================================================================
  onImportLog(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isImporting.set(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('Tệp không có nội dung.');

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error('Tệp rỗng hoặc không có dữ liệu sau tiêu đề.');

        let count = 0;
        const currentList = this.records();

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/[,;\t]/).map((p) => p.replace(/^["']|["']$/g, '').trim());
          if (parts.length < 5) continue;

          const empCode = parts[0];
          const checkIn = parts[3];
          const checkOut = parts[4];

          const rec = currentList.find((r) => r.employeeCode.toLowerCase() === empCode.toLowerCase());
          if (rec) {
            this.attendanceApi.adjustAttendance(
              rec.id,
              checkIn,
              checkOut,
              'Nhập tự động từ máy chấm công',
              'Hệ thống Máy chấm công'
            ).subscribe();
            count++;
          }
        }

        if (count > 0) {
          this.toastService.success(`Đã đồng bộ ${count} lượt chấm công từ máy quét vân tay!`);
          this.loadAttendanceData();
        } else {
          this.toastService.warning('Không tìm thấy bản ghi nào khớp với danh sách ca ngày này.');
        }
      } catch (err: any) {
        this.toastService.error(`Lỗi đọc tệp: ${err.message}`);
      } finally {
        this.isImporting.set(false);
        input.value = '';
      }
    };

    reader.onerror = () => {
      this.toastService.error('Đã xảy ra lỗi khi đọc tệp tin.');
      this.isImporting.set(false);
      input.value = '';
    };

    reader.readAsText(file, 'UTF-8');
  }

  getStatusBadge(rec: AttendanceRecord): { label: string; variant: BadgeVariant } {
    switch (rec.status) {
      case 'on_time':
        return { label: rec.statusLabel, variant: 'success' };
      case 'late':
        return { label: rec.statusLabel, variant: 'warning' };
      case 'early_leave':
        return { label: rec.statusLabel, variant: 'warning' };
      case 'absent':
        return { label: rec.statusLabel, variant: 'danger' };
      default:
        return { label: rec.statusLabel, variant: 'neutral' };
    }
  }
}
