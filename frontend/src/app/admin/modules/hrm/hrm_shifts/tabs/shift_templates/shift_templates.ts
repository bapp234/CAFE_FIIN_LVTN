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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCopy,
  LucideEdit,
  LucidePlus,
  LucideRotateCcw,
  LucideTrash2,
} from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminFormField } from '../../../../../shared/admin_form_field/admin_form_field';
import { AdminDrawer } from '../../../../../shared/admin_drawer/admin_drawer';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
  GridSort,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { ShiftTemplate } from '../../../models/shift';
import { HrmShiftApi } from '../../../services/hrm_shift_api';

@Component({
  selector: 'app-shift-templates',
  templateUrl: './shift_templates.html',
  styleUrl: './shift_templates.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucidePlus,
    LucideEdit,
    LucideCopy,
    LucideTrash2,
    LucideRotateCcw,
    AdminFormField,
    AdminDrawer,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
  ],
})
export class ShiftTemplates {
  readonly branchService = inject(AdminBranchService);
  private readonly shiftApi = inject(HrmShiftApi);
  private readonly toastService = inject(AdminToastService);

  // ---- Bộ lọc & Sắp xếp ----
  readonly searchQuery = signal('');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);

  // ---- Dữ liệu & Lựa chọn ----
  readonly templates = signal<ShiftTemplate[]>([]);
  readonly selectedTemplateCodes = signal<string[]>([]);

  // ---- Drawer Thêm / Sửa ----
  readonly isDrawerOpen = signal(false);
  readonly editingTemplateId = signal<string | null>(null);

  // ---- Modal Xóa ----
  readonly deletingTemplate = signal<ShiftTemplate | null>(null);
  readonly isDeleteModalOpen = signal(false);

  // =========================================================================
  // CẤU HÌNH CỘT & DÒNG CHO ADMIN-GRID-TABLE
  // =========================================================================
  readonly templateColumns: GridColumn[] = [
    { key: 'code', label: 'Mã ca', type: 'code', width: '8rem', sortable: true },
    { key: 'name', label: 'Tên mẫu ca làm việc', type: 'text', bold: true, minWidth: '14rem', sortable: true },
    {
      key: 'colorGroup',
      label: 'Phân nhóm ca',
      type: 'badge',
      align: 'center',
      width: '10rem',
      sortable: true,
      badgeMap: {
        emerald: { label: 'Ca Sáng', variant: 'success' },
        amber: { label: 'Ca Chiều', variant: 'warning' },
        indigo: { label: 'Ca Tối', variant: 'info' },
        rose: { label: 'Ca Full / Gãy', variant: 'danger' },
      },
    },
    { key: 'startTime', label: 'Giờ vào ca', type: 'text', align: 'center', mono: true, width: '7.5rem', sortable: true },
    { key: 'endTime', label: 'Giờ tan ca', type: 'text', align: 'center', mono: true, width: '7.5rem', sortable: true },
    { key: 'timeRange', label: 'Khung giờ trực', type: 'pill', align: 'center', width: '9.5rem' },
    {
      key: 'breakMinutes',
      label: 'Nghỉ giữa ca',
      type: 'number',
      align: 'right',
      width: '8rem',
      suffix: ' phút',
      sortable: true,
    },
    {
      key: 'standardHours',
      label: 'Giờ công chuẩn',
      type: 'number',
      align: 'right',
      width: '8.5rem',
      bold: true,
      tone: 'success',
      suffix: ' giờ',
      sortable: true,
    },
  ];

  readonly templateRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();

    return this.templates()
      .filter((t) => {
        return (
          !kw ||
          t.code.toLowerCase().includes(kw) ||
          t.name.toLowerCase().includes(kw)
        );
      })
      .map((t) => ({
        _raw: t,
        id: t.id,
        code: t.code,
        name: t.name,
        colorGroup: t.color || 'emerald',
        startTime: t.startTime,
        endTime: t.endTime,
        timeRange: `${t.startTime} – ${t.endTime}`,
        breakMinutes: t.breakMinutes,
        standardHours: t.standardHours,
      }));
  });

  readonly templateForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl('06:30', { nonNullable: true, validators: [Validators.required] }),
    endTime: new FormControl('12:00', { nonNullable: true, validators: [Validators.required] }),
    breakMinutes: new FormControl(15, { nonNullable: true, validators: [Validators.required] }),
    standardHours: new FormControl(5.25, { nonNullable: true, validators: [Validators.required] }),
    color: new FormControl('emerald', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadTemplates();
      });
    });
  }

  loadTemplates(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();

    this.shiftApi.getShiftTemplates(branchId).subscribe({
      next: (res) => {
        this.templates.set(res);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  // =========================================================================
  // SỰ KIỆN BẢNG LƯỚI & BỘ LỌC
  // =========================================================================
  onRowClick(row: GridRow): void {
    const code = String(row['code']);
    const current = this.selectedTemplateCodes();
    if (current.includes(code)) {
      this.selectedTemplateCodes.set(current.filter((c) => c !== code));
    } else {
      this.selectedTemplateCodes.set([...current, code]);
    }
  }

  clearSelection(): void {
    this.selectedTemplateCodes.set([]);
  }

  isAllSelected(): boolean {
    const rows = this.templateRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedTemplateCodes());
    return rows.every((r) => selected.has(String(r['code'])));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedTemplateCodes.set(this.templateRows().map((r) => String(r['code'])));
    }
  }

  onSortChange(sort: GridSort): void {
    this.sortBy.set(sort.key);
    this.sortOrder.set(sort.order);
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.selectedTemplateCodes.set([]);
    this.loadTemplates();
    this.toastService.success('Đã làm mới danh mục mẫu ca!');
  }

  // =========================================================================
  // CRUD MẪU CA QUA DRAWER
  // =========================================================================
  recalculateHours(): void {
    const { startTime, endTime, breakMinutes } = this.templateForm.getRawValue();
    if (!startTime || !endTime) return;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes <= 0) totalMinutes += 24 * 60;

    const netHours = Math.max(0, (totalMinutes - (breakMinutes || 0)) / 60);
    this.templateForm.controls.standardHours.setValue(Math.round(netHours * 100) / 100);
  }

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

  editFromRow(row: GridRow): void {
    const t = row['_raw'] as ShiftTemplate | undefined;
    if (!t) return;
    this.editingTemplateId.set(t.id);
    this.templateForm.reset({
      code: t.code,
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      breakMinutes: t.breakMinutes,
      standardHours: t.standardHours,
      color: t.color || 'emerald',
    });
    this.isDrawerOpen.set(true);
  }

  duplicateFromRow(row: GridRow): void {
    const t = row['_raw'] as ShiftTemplate | undefined;
    if (!t) return;
    this.editingTemplateId.set(null);
    this.templateForm.reset({
      code: `${t.code}-COPY`,
      name: `${t.name} (Bản sao)`,
      startTime: t.startTime,
      endTime: t.endTime,
      breakMinutes: t.breakMinutes,
      standardHours: t.standardHours,
      color: t.color || 'emerald',
    });
    this.isDrawerOpen.set(true);
  }

  deleteFromRow(row: GridRow): void {
    const t = row['_raw'] as ShiftTemplate | undefined;
    if (!t) return;
    this.deletingTemplate.set(t);
    this.isDeleteModalOpen.set(true);
  }

  confirmDelete(): void {
    const t = this.deletingTemplate();
    if (!t) return;

    this.shiftApi.deleteShiftTemplate(t.id).subscribe({
      next: () => {
        this.toastService.success(`Đã xóa mẫu ca "${t.name}" (${t.code})`);
        this.isDeleteModalOpen.set(false);
        this.deletingTemplate.set(null);
        this.loadTemplates();
      },
      error: (err) => {
        this.toastService.error(err?.message || 'Không thể xóa mẫu ca làm việc');
      },
    });
  }

  cancelDelete(): void {
    this.isDeleteModalOpen.set(false);
    this.deletingTemplate.set(null);
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
          this.loadTemplates();
        },
        error: (err) => this.toastService.error(err.message),
      });
    } else {
      this.shiftApi.createShiftTemplate(val).subscribe({
        next: (created) => {
          this.toastService.success(`Đã thêm mẫu ca "${created.name}"`);
          this.isDrawerOpen.set(false);
          this.loadTemplates();
        },
        error: (err) => this.toastService.error(err.message),
      });
    }
  }
}