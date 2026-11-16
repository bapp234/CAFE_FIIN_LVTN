import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCalendar,
  LucideClock,
  LucideDownload,
  LucideEdit,
  LucideFileText,
  LucidePlus,
  LucideUpload,
} from '@lucide/angular';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminPageHeader } from '../../../shared/admin_page_header/admin_page_header';
import { AdminFormField } from '../../../shared/admin_form_field/admin_form_field';
import { AdminDrawer } from '../../../shared/admin_drawer/admin_drawer';
import { Employee } from '../models/employee';
import { ShiftAssignment, ShiftTemplate } from '../models/shift';
import { HrmEmployeeApi } from '../services/hrm_employee_api';
import { HrmShiftApi } from '../services/hrm_shift_api';
import { HrmScheduleGrid } from '../components/hrm_schedule_grid/hrm_schedule_grid';

@Component({
  selector: 'app-hrm-shifts',
  templateUrl: './hrm_shifts.html',
  styleUrl: './hrm_shifts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideCalendar,
    LucideClock,
    LucidePlus,
    LucideEdit,
    LucideUpload,
    LucideDownload,
    LucideFileText,
    AdminPageHeader,
    AdminFormField,
    AdminDrawer,
    HrmScheduleGrid,
  ],
})
export class HrmShifts {
  readonly branchService = inject(AdminBranchService);
  private readonly shiftApi = inject(HrmShiftApi);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);

  readonly activeTab = signal<'schedule' | 'templates'>('schedule');

  // Schedule Grid State
  readonly weekStart = signal<string>('2026-11-09'); // Thứ hai
  readonly employees = signal<Employee[]>([]);
  readonly templates = signal<ShiftTemplate[]>([]);
  readonly assignments = signal<ShiftAssignment[]>([]);
  readonly isLoading = signal(false);
  readonly isImporting = signal(false);

  // Drawer for Shift Template (CRUD)
  readonly isDrawerOpen = signal(false);
  readonly editingTemplateId = signal<string | null>(null);

  readonly templateForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl('06:30', { nonNullable: true, validators: [Validators.required] }),
    endTime: new FormControl('12:00', { nonNullable: true, validators: [Validators.required] }),
    breakMinutes: new FormControl(15, { nonNullable: true, validators: [Validators.required] }),
    standardHours: new FormControl(5.5, { nonNullable: true, validators: [Validators.required] }),
    color: new FormControl('emerald', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const branchId = this.branchService.selectedBranchId();
      this.loadData();
    });
  }

  loadData(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();

    // 1. Load active employees
    this.employeeApi.getEmployees({ page: 1, size: 50, branchId, status: 'working' }).subscribe((res) => {
      this.employees.set(res.items);
    });

    // 2. Load shift templates
    this.shiftApi.getShiftTemplates(branchId).subscribe((res) => {
      this.templates.set(res);
    });

    // 3. Load week schedule assignments
    const start = this.weekStart();
    const d = new Date(start);
    d.setDate(d.getDate() + 6);
    const end = d.toISOString().split('T')[0];

    this.shiftApi.getWeekSchedule({ branchId, startDate: start, endDate: end }).subscribe((res) => {
      this.assignments.set(res);
      this.isLoading.set(false);
    });
  }

  onWeekChange(action: 'prev' | 'next' | 'today'): void {
    const cur = new Date(this.weekStart());
    if (action === 'prev') {
      cur.setDate(cur.getDate() - 7);
    } else if (action === 'next') {
      cur.setDate(cur.getDate() + 7);
    } else {
      cur.setTime(new Date('2026-11-09').getTime());
    }
    this.weekStart.set(cur.toISOString().split('T')[0]);
    this.loadData();
  }

  onAssignShift(evt: { employee: Employee; date: string; shift: ShiftTemplate }): void {
    const newAsg: ShiftAssignment = {
      id: `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: evt.employee.id,
      employeeCode: evt.employee.code,
      employeeName: evt.employee.fullName,
      branchId: evt.employee.branchId,
      date: evt.date,
      shiftId: evt.shift.id,
      shiftCode: evt.shift.code,
      shiftName: evt.shift.name,
      startTime: evt.shift.startTime,
      endTime: evt.shift.endTime,
      registeredBy: 'manager',
      status: 'scheduled',
    };

    this.shiftApi.saveShiftAssignment(newAsg).subscribe({
      next: (saved) => {
        this.assignments.update((list) => [...list, saved]);
        this.toastService.success(`Đã xếp ${saved.shiftCode} cho ${saved.employeeName} (${saved.date})`);
      },
      error: (err) => this.toastService.error(err.message),
    });
  }

  onRemoveShift(asgId: string): void {
    this.shiftApi.removeShiftAssignment(asgId).subscribe({
      next: () => {
        this.assignments.update((list) => list.filter((a) => a.id !== asgId));
        this.toastService.info('Đã hủy ca làm việc.');
      },
      error: (err) => this.toastService.error(err.message),
    });
  }

  // =========================================================================
  // XUẤT FILE EXCEL LỊCH PHÂN CA TUẦN (.CSV UTF-8 BOM MỞ BẰNG MS EXCEL)
  // =========================================================================
  onExportExcel(): void {
    const emps = this.employees();
    const asgs = this.assignments();
    const tmpls = this.templates();
    const start = new Date(this.weekStart());

    // Tạo danh sách 7 ngày
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][i];
      const display = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return { iso, label: `${dayName} (${display})` };
    });

    // Tiêu đề các cột
    const headers = ['Mã NV', 'Họ và tên', 'Chức vụ', 'Chi nhánh', ...weekDays.map((w) => w.label), 'Tổng số ca', 'Tổng giờ công'];

    const rows: string[][] = [];

    emps.forEach((emp) => {
      let empShiftCount = 0;
      let empTotalHours = 0;

      const dayCells = weekDays.map((w) => {
        const found = asgs.find((a) => a.employeeId === emp.id && a.date === w.iso && a.status !== 'cancelled');
        if (found) {
          empShiftCount++;
          const tmpl = tmpls.find((t) => t.id === found.shiftId || t.code === found.shiftCode);
          empTotalHours += tmpl ? tmpl.standardHours : 5.5;
          return `${found.shiftCode} (${found.startTime}-${found.endTime})`;
        }
        return 'Nghỉ';
      });

      rows.push([
        emp.code,
        `"${emp.fullName.replace(/"/g, '""')}"`,
        `"${emp.position || ''}"`,
        `"${emp.branchName || ''}"`,
        ...dayCells.map((c) => `"${c}"`),
        String(empShiftCount),
        `${empTotalHours}h`,
      ]);
    });

    // Ghép nội dung CSV có Byte Order Mark \uFEFF cho Microsoft Excel đọc tiếng Việt chuẩn
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const endD = new Date(start);
    endD.setDate(endD.getDate() + 6);
    const dateRangeStr = `${start.toISOString().split('T')[0]}_den_${endD.toISOString().split('T')[0]}`;

    link.setAttribute('href', url);
    link.setAttribute('download', `Lich_Phan_Ca_FiinCoffee_${dateRangeStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toastService.success('Đã xuất lịch phân ca tuần ra tệp Excel (.csv) thành công!');
  }

  // =========================================================================
  // TẢI FILE MẪU EXCEL PHÂN CA (.CSV UTF-8 BOM)
  // =========================================================================
  downloadExcelTemplate(): void {
    const headers = ['Mã NV', 'Họ và tên', 'Ngày làm việc (YYYY-MM-DD)', 'Mã ca (CA-SANG / CA-CHIEU / CA-TOI / CA-FULL)', 'Ghi chú'];
    const sampleRows = [
      ['NV001', '"Đặng Quốc Anh"', '2026-11-09', 'CA-SANG', '"Mở quán sáng"'],
      ['NV002', '"Nguyễn Thị Hương"', '2026-11-09', 'CA-CHIEU', '"Ca cao điểm"'],
      ['NV003', '"Lê Thanh Tùng"', '2026-11-10', 'CA-FULL', '"Ca quản lý điều hành"'],
      ['NV004', '"Phạm Minh Tuấn"', '2026-11-10', 'CA-TOI', '"Ca tối đóng quán"'],
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', 'Template_Nhap_Ca_Lam_FiinCoffee.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toastService.info('Đã tải file Excel mẫu. Vui lòng nhập dữ liệu và tải lên lại!');
  }

  // =========================================================================
  // NHẬP CA LÀM BẰNG CÁCH IMPORT FILE EXCEL (.CSV, .XLSX)
  // =========================================================================
  onImportExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isImporting.set(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('Tệp tải lên không có nội dung.');
        }

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) {
          throw new Error('Tệp không chứa dòng dữ liệu nào ngoài tiêu đề.');
        }

        // Bỏ dòng tiêu đề (index 0)
        let successCount = 0;
        const newAssignments: ShiftAssignment[] = [];
        const currentEmployees = this.employees();
        const currentTemplates = this.templates();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // Phân tách dấu phẩy hoặc chấm phẩy
          const parts = line.split(/[,;\t]/).map((p) => p.replace(/^["']|["']$/g, '').trim());
          if (parts.length < 4) continue;

          const empCode = parts[0];
          const dateStr = parts[2];
          const shiftCode = parts[3];

          // Tìm nhân viên
          const emp = currentEmployees.find(
            (e) => (e.code && e.code.toLowerCase() === empCode.toLowerCase()) ||
                   (e.employeeCode && e.employeeCode.toLowerCase() === empCode.toLowerCase())
          );
          if (!emp) continue;

          // Tìm mẫu ca
          const tmpl = currentTemplates.find(
            (t) => t.code.toLowerCase() === shiftCode.toLowerCase() ||
                   t.id.toLowerCase() === shiftCode.toLowerCase()
          );
          if (!tmpl) continue;

          const newAsg: ShiftAssignment = {
            id: `asg-imp-${Date.now()}-${i}`,
            employeeId: emp.id,
            employeeCode: emp.code,
            employeeName: emp.fullName,
            branchId: emp.branchId,
            date: dateStr,
            shiftId: tmpl.id,
            shiftCode: tmpl.code,
            shiftName: tmpl.name,
            startTime: tmpl.startTime,
            endTime: tmpl.endTime,
            registeredBy: 'manager',
            status: 'scheduled',
          };

          this.shiftApi.saveShiftAssignment(newAsg).subscribe({
            next: (saved) => {
              newAssignments.push(saved);
              this.assignments.update((list) => [...list, saved]);
            },
          });
          successCount++;
        }

        if (successCount > 0) {
          this.toastService.success(`Đã nhập thành công ${successCount} ca làm việc từ file Excel!`);
        } else {
          this.toastService.error('Không tìm thấy dòng dữ liệu nào khớp với danh sách nhân sự và mã ca hiện tại.');
        }
      } catch (err: any) {
        this.toastService.error(`Lỗi khi đọc file: ${err.message || 'Định dạng không hợp lệ'}`);
      } finally {
        this.isImporting.set(false);
        // Reset file input để có thể chọn lại file cùng tên
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

  // =========================================================================
  // CRUD MẪU CA LÀM VIỆC (SHIFT TEMPLATES)
  // =========================================================================
  openCreateTemplate(): void {
    this.editingTemplateId.set(null);
    this.templateForm.reset({
      code: '',
      name: '',
      startTime: '08:00',
      endTime: '16:00',
      breakMinutes: 30,
      standardHours: 7.5,
      color: 'emerald',
    });
    this.isDrawerOpen.set(true);
  }

  openEditTemplate(t: ShiftTemplate): void {
    this.editingTemplateId.set(t.id);
    this.templateForm.reset({
      code: t.code,
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      breakMinutes: t.breakMinutes,
      standardHours: t.standardHours,
      color: t.color,
    });
    this.isDrawerOpen.set(true);
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();
      this.toastService.error('Vui lòng kiểm tra lại thông tin ca!');
      return;
    }

    const val = this.templateForm.getRawValue();
    const id = this.editingTemplateId();

    if (id) {
      this.shiftApi.updateShiftTemplate(id, val).subscribe({
        next: (updated) => {
          this.toastService.success(`Đã cập nhật ca "${updated.name}"`);
          this.isDrawerOpen.set(false);
          this.loadData();
        },
        error: (err) => this.toastService.error(err.message),
      });
    } else {
      this.shiftApi.createShiftTemplate(val).subscribe({
        next: (created) => {
          this.toastService.success(`Đã thêm mẫu ca "${created.name}"`);
          this.isDrawerOpen.set(false);
          this.loadData();
        },
        error: (err) => this.toastService.error(err.message),
      });
    }
  }
}
