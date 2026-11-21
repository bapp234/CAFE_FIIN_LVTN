import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideCheck,
  LucideCheckCircle,
  LucideDownload,
  LucideFilePlus2,
  LucideFileText,
  LucideFileWarning,
  LucideRotateCcw,
  LucideSave,
  LucideUndo2,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { AdminSession } from '../../../../../core/admin_session';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminDrawer } from '../../../../../shared/admin_drawer/admin_drawer';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminFormField } from '../../../../../shared/admin_form_field/admin_form_field';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { ContractType, Employee } from '../../../models/employee';
import { HrmEmployeeApi } from '../../../services/hrm_employee_api';
import {
  ContractImportPreviewResult,
  ContractItem,
  ContractSummary,
  ContractTabMode,
  HrmContractApi,
} from '../../../services/hrm_contract_api';
import {
  buildEmployeeComboOptions,
  getCurrentUsername,
  getEmployeeNumericId,
} from '../../../hrm_requests/request_helpers';

interface EditableContractRow {
  contractId: number;
  contractTypeId: number;
  position: string;
  hourlyRate: number;
  allowance: number;
  startDate: string;
  endDate: string;
  note: string;
}

@Component({
  selector: 'app-contract-grid-tab',
  templateUrl: './contract_grid.html',
  styleUrl: './contract_grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAlertCircle,
    LucideAlertTriangle,
    LucideCheck,
    LucideCheckCircle,
    LucideDownload,
    LucideFilePlus2,
    LucideFileText,
    LucideFileWarning,
    LucideRotateCcw,
    LucideSave,
    LucideUndo2,
    LucideUpload,
    LucideX,
    AdminDrawer,
    AdminModal,
    AdminFormField,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class ContractGridTab implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(AdminSession);
  readonly branchService = inject(AdminBranchService);
  private readonly contractApi = inject(HrmContractApi);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);

  readonly tabMode = signal<ContractTabMode>(
    (this.route.snapshot.data?.['tabMode'] as ContractTabMode) || 'current'
  );

  readonly searchQuery = signal(this.route.snapshot.queryParamMap.get('search') ?? '');
  readonly selectedEmployeeFilter = signal<string>(
    this.route.snapshot.queryParamMap.get('employeeId') ?? 'all'
  );
  readonly selectedTypeFilter = signal<string>('all');
  readonly selectedStatusFilter = signal<string>('all');
  readonly expiringDaysFilter = signal<string>('30');

  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);

  readonly items = signal<ContractItem[]>([]);
  readonly summary = signal<ContractSummary>({
    activeCount: 0,
    expiringSoonCount: 0,
    pendingApprovalCount: 0,
    closedCount: 0,
  });
  readonly contractTypes = signal<ContractType[]>([]);
  readonly employees = signal<Employee[]>([]);

  // Bản nháp sửa trực tiếp trên từng dòng của bảng (key = contractId)
  readonly draftEdits = signal<Record<number, EditableContractRow>>({});

  // TemplateRef cho cột sửa trực tiếp trên bảng (chỉ cho phép sửa Loại hợp đồng)
  private readonly tplContractType = viewChild<TemplateRef<unknown>>('tplContractType');

  readonly isDirectApprover = computed(() => this.session.hierarchyLevel() >= 4);
  readonly isAccountantReadOnly = computed(() => {
    const u = this.session.user();
    if (!u) return true;
    const isAcc = u.roles.some((r) => r.toLowerCase() === 'accountant');
    return isAcc && u.hierarchyLevel < 5 && !u.roles.some((r) => r.toLowerCase() === 'hrmanager');
  });
  readonly canProposeChange = computed(
    () => !this.isAccountantReadOnly() && this.session.hierarchyLevel() >= 3
  );
  readonly isInlineEditableTab = computed(
    () => this.canProposeChange() && this.tabMode() === 'current'
  );

  readonly cellTemplates = computed<Record<string, TemplateRef<unknown>>>(() => {
    if (!this.isInlineEditableTab()) return {};
    const map: Record<string, TemplateRef<unknown>> = {};
    if (this.tplContractType()) map['contractName'] = this.tplContractType()!;
    return map;
  });

  // ---- Drawer chỉ dùng cho "+ Ký hợp đồng mới" ----
  readonly isCreateDrawerOpen = signal(false);
  readonly formEmployeeId = signal<number>(0);
  readonly formContractTypeId = signal<number>(3);
  readonly formPosition = signal<string>('');
  readonly formHourlyRate = signal<number>(28000);
  readonly formAllowance = signal<number>(0);
  readonly formStartDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly formEndDate = signal<string>('');
  readonly formNote = signal<string>('');

  // ---- Quy trình Xuất / Nhập Excel chuẩn theo Danh sách nhân viên ----
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly selectedFileName = signal('');
  readonly isImportModalOpen = signal(false);
  readonly isImporting = signal(false);
  readonly previewTab = signal<'all' | 'valid' | 'error'>('all');
  readonly importPreview = signal<ContractImportPreviewResult | null>(null);

  readonly filteredPreviewItems = computed(() => {
    const pv = this.importPreview();
    if (!pv) return [];
    const tab = this.previewTab();
    if (tab === 'valid') return pv.items.filter((i) => i.isValid);
    if (tab === 'error') return pv.items.filter((i) => !i.isValid);
    return pv.items;
  });

  readonly employeeFilterOptions = computed<ComboOption[]>(() =>
    buildEmployeeComboOptions(this.employees(), true)
  );

  readonly employeePickerOptions = computed<ComboOption[]>(() =>
    buildEmployeeComboOptions(this.employees(), false)
  );

  readonly contractTypeFilterOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả loại HĐ' },
    ...this.contractTypes().map((t) => ({
      value: String(t.contractTypeId),
      label: `${t.contractCode} — ${t.contractName}`,
    })),
  ]);

  readonly statusOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'active', label: 'Đang hiệu lực' },
    { value: 'expired', label: 'Hết hạn' },
    { value: 'terminated', label: 'Đã thanh lý' },
    { value: 'rejected', label: 'Từ chối' },
  ];

  readonly expiringDaysOptions: ComboOption[] = [
    { value: '15', label: 'Trong 15 ngày' },
    { value: '30', label: 'Trong 30 ngày' },
    { value: '60', label: 'Trong 60 ngày' },
    { value: '90', label: 'Trong 90 ngày' },
  ];

  readonly columns = computed<GridColumn[]>(() => {
    const mode = this.tabMode();
    const inline = this.isInlineEditableTab();
    const cols: GridColumn[] = [
      { key: 'contractCode', label: 'Mã HĐ', type: 'code', width: '8.75rem', subKey: 'actionLabel' },
      { key: 'employeeCode', label: 'Mã NV', type: 'code', width: '5.75rem' },
      { key: 'fullName', label: 'Nhân sự', type: 'text', bold: true, minWidth: '11rem' },
      { key: 'position', label: 'Chức vụ', type: 'text', minWidth: '11.5rem' },
      { key: 'branchName', label: 'Chi nhánh', type: 'pill', width: '9.5rem' },
      { key: 'contractName', label: 'Loại hợp đồng', type: 'text', minWidth: '13.5rem', editable: inline },
      { key: 'hourlyRate', label: 'Lương/giờ (₫)', type: 'currency', align: 'right', width: '7.5rem', bold: true },
      { key: 'allowance', label: 'Phụ cấp (₫)', type: 'currency', align: 'right', width: '7.5rem' },
      { key: 'startDate', label: 'Hiệu lực từ', type: 'date', width: '8.5rem' },
      { key: 'endDateText', label: 'Đến ngày', type: 'text', align: 'center', width: '8.5rem' },
    ];

    if (mode === 'expiring') {
      cols.push({
        key: 'daysLeftText',
        label: 'Thời hạn còn',
        type: 'text',
        align: 'center',
        width: '7.5rem',
        bold: true,
        tone: 'info',
      });
    }

    cols.push({
      key: 'status',
      label: 'Trạng thái',
      type: 'badge',
      align: 'center',
      width: '8rem',
      badgeMap: {
        pending: { label: 'Chờ duyệt', variant: 'warning' },
        active: { label: 'Hiệu lực', variant: 'success' },
        expired: { label: 'Hết hạn', variant: 'neutral' },
        terminated: { label: 'Đã thanh lý', variant: 'danger' },
        rejected: { label: 'Từ chối', variant: 'danger' },
      },
    });

    if (mode === 'history') {
      cols.push({
        key: 'approvalTrace',
        label: 'Người đề xuất / Duyệt',
        type: 'text',
        minWidth: '11.5rem',
        subKey: 'note',
      });
    }

    return cols;
  });

  readonly gridRows = computed<GridRow[]>(() => {
    const drafts = this.draftEdits();
    return this.items().map((item) => {
      const draft = drafts[item.contractId];
      const actionMap: Record<string, string> = {
        new: 'Ký mới',
        renew: 'Gia hạn',
        adjust: 'Điều chỉnh',
        terminate: 'Thanh lý',
      };
      const days = item.daysRemaining;
      const daysLeftText =
        days === null || days === undefined
          ? 'Không thời hạn'
          : days < 0
            ? `Quá hạn ${Math.abs(days)} ngày`
            : days === 0
              ? 'Hết hạn hôm nay'
              : `Còn ${days} ngày`;

      const traceParts: string[] = [];
      if (item.requestedByName) traceParts.push(`Đề xuất: ${item.requestedByName}`);
      if (item.approvedByName) traceParts.push(`Duyệt: ${item.approvedByName}`);

      const startIso = this.toIsoDate(item.startDate);
      const endIso = this.toIsoDate(item.endDate);

      return {
        _raw: item,
        _dirty: !!draft,
        _contractTypeId: draft ? draft.contractTypeId : item.contractTypeId,
        _startDateIso: draft ? draft.startDate : startIso,
        _endDateIso: draft ? draft.endDate : endIso,
        contractId: item.contractId,
        contractCode: item.contractCode,
        actionLabel: item.actionType ? actionMap[item.actionType] ?? item.actionType : 'Hợp đồng',
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        position: draft ? draft.position : item.position,
        branchName: item.branchName || '—',
        contractName: item.contractName,
        hourlyRate: draft ? draft.hourlyRate : item.hourlyRate,
        allowance: draft ? draft.allowance : item.allowance,
        startDate: draft ? draft.startDate : item.startDate,
        endDateText: draft
          ? draft.endDate
            ? this.formatDate(draft.endDate)
            : 'Không xác định'
          : item.endDate
            ? this.formatDate(item.endDate)
            : 'Không xác định',
        daysLeftText,
        status: item.status.toLowerCase(),
        approvalTrace: traceParts.join(' · ') || 'Khởi tạo hệ thống',
        note: item.note || '',
      };
    });
  });

  constructor() {
    effect(() => {
      const branchId = this.branchService.selectedBranchId();
      this.tabMode();
      this.searchQuery();
      this.selectedEmployeeFilter();
      this.selectedTypeFilter();
      this.selectedStatusFilter();
      this.expiringDaysFilter();

      untracked(() => {
        this.loadContracts();
        this.loadSummary(branchId);
      });
    });
  }

  ngOnInit(): void {
    this.contractApi.getContractTypes().subscribe({
      next: (list) => this.contractTypes.set(list.filter((x) => x.isActive)),
    });

    const user = this.session.user();
    this.employeeApi
      .getEmployeesByHierarchy({
        currentUsername: getCurrentUsername(user),
        branchId: this.branchService.selectedBranchId(),
        pageIndex: 1,
        pageSize: 200,
      })
      .subscribe({
        next: (res) => {
          this.employees.set(res.items);
          if (res.items.length > 0 && !this.formEmployeeId()) {
            this.formEmployeeId.set(getEmployeeNumericId(res.items[0]));
          }
        },
      });
  }

  loadContracts(): void {
    this.isLoading.set(true);
    const empVal = this.selectedEmployeeFilter();
    const typeVal = this.selectedTypeFilter();
    this.contractApi
      .getContracts({
        tabMode: this.tabMode(),
        branchId: this.branchService.selectedBranchId(),
        employeeId: empVal !== 'all' ? Number(empVal) : null,
        contractTypeId: typeVal !== 'all' ? Number(typeVal) : null,
        status: this.selectedStatusFilter(),
        expiringDays: Number(this.expiringDaysFilter()) || 30,
        search: this.searchQuery(),
      })
      .subscribe({
        next: (list) => {
          this.items.set(list);
          this.draftEdits.set({});
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.toastService.error(err.message);
        },
      });
  }

  loadSummary(branchId?: string): void {
    this.contractApi
      .getSummary(branchId ?? this.branchService.selectedBranchId(), Number(this.expiringDaysFilter()) || 30)
      .subscribe({
        next: (s) => this.summary.set(s),
      });
  }

  refresh(): void {
    this.searchQuery.set('');
    this.selectedEmployeeFilter.set('all');
    this.selectedTypeFilter.set('all');
    this.selectedStatusFilter.set('all');
    this.draftEdits.set({});
    this.loadContracts();
    this.loadSummary();
    this.toastService.success('Đã làm mới danh sách hợp đồng.');
  }

  // ---- Inline Excel Editing ngay trên từng ô của bảng ----
  patchRowField(row: GridRow, field: keyof EditableContractRow, value: unknown): void {
    const raw = row['_raw'] as ContractItem;
    if (raw.status.toLowerCase() !== 'active') return;

    this.draftEdits.update((map) => {
      const current: EditableContractRow = map[raw.contractId] ?? {
        contractId: raw.contractId,
        contractTypeId: raw.contractTypeId,
        position: raw.position,
        hourlyRate: raw.hourlyRate,
        allowance: raw.allowance,
        startDate: this.toIsoDate(raw.startDate),
        endDate: this.toIsoDate(raw.endDate),
        note: `Điều chỉnh trực tiếp trên bảng từ HĐ ${raw.contractCode}`,
      };

      const next: EditableContractRow = { ...current, [field]: value };

      // Khi đổi loại HĐ ngay trên bảng -> tự đổ lương chuẩn, phụ cấp chuẩn và tính lại ngày hết hạn
      if (field === 'contractTypeId') {
        const typeId = Number(value);
        const found = this.contractTypes().find((t) => t.contractTypeId === typeId);
        if (found) {
          if (found.standardHourlyRate > 0) next.hourlyRate = found.standardHourlyRate;
          next.allowance = found.allowance || 0;
          next.endDate = this.calcEndDate(typeId, next.startDate);
        }
      } else if (field === 'startDate') {
        next.endDate = this.calcEndDate(next.contractTypeId, String(value));
      }

      return { ...map, [raw.contractId]: next };
    });
  }

  discardRowDraft(row: GridRow): void {
    const raw = row['_raw'] as ContractItem;
    this.draftEdits.update((map) => {
      const copy = { ...map };
      delete copy[raw.contractId];
      return copy;
    });
  }

  saveInlineRow(row: GridRow): void {
    const raw = row['_raw'] as ContractItem;
    const draft = this.draftEdits()[raw.contractId];
    if (!draft) return;

    if (!draft.position.trim() || !draft.startDate) {
      this.toastService.warning('Chức vụ và ngày hiệu lực không được để trống.');
      return;
    }

    this.isSubmitting.set(true);
    this.contractApi
      .submitContractChange({
        employeeId: raw.employeeId,
        contractTypeId: Number(draft.contractTypeId),
        position: draft.position.trim(),
        hourlyRate: Number(draft.hourlyRate) || 0,
        allowance: Number(draft.allowance) || 0,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
        actionType: this.tabMode() === 'expiring' ? 'renew' : 'adjust',
        targetContractId: raw.contractId,
        note: draft.note,
        autoApproveIfAllowed: this.isDirectApprover(),
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.toastService.success(res.message);
          this.loadContracts();
          this.loadSummary();
        },
        error: (err: Error) => {
          this.isSubmitting.set(false);
          this.toastService.error(err.message);
        },
      });
  }

  terminateRow(row: GridRow): void {
    const raw = row['_raw'] as ContractItem;
    const todayStr = new Date().toISOString().slice(0, 10);
    this.contractApi
      .submitContractChange({
        employeeId: raw.employeeId,
        contractTypeId: raw.contractTypeId,
        position: raw.position,
        hourlyRate: raw.hourlyRate,
        allowance: raw.allowance,
        startDate: todayStr,
        endDate: todayStr,
        actionType: 'terminate',
        targetContractId: raw.contractId,
        note: `Thanh lý hợp đồng ${raw.contractCode}`,
        autoApproveIfAllowed: this.isDirectApprover(),
      })
      .subscribe({
        next: (res) => {
          this.toastService.success(res.message);
          this.loadContracts();
          this.loadSummary();
        },
        error: (err: Error) => this.toastService.error(err.message),
      });
  }

  approveRow(row: GridRow, decision: 'approved' | 'rejected'): void {
    const raw = row['_raw'] as ContractItem;
    this.contractApi.processApproval(raw.contractId, decision).subscribe({
      next: (msg) => {
        this.toastService.success(msg);
        this.loadContracts();
        this.loadSummary();
      },
      error: (err: Error) => this.toastService.error(err.message),
    });
  }

  // ---- Drawer Ký hợp đồng mới / Gia hạn ----
  readonly drawerActionType = signal<'new' | 'renew'>('new');
  readonly drawerTargetContractId = signal<number | null>(null);

  openCreateDrawer(): void {
    this.drawerActionType.set('new');
    this.drawerTargetContractId.set(null);
    const firstEmp = this.employees()[0];
    if (firstEmp) {
      this.onDrawerEmployeeChange('' + getEmployeeNumericId(firstEmp));
    }
    this.formNote.set('');
    this.isCreateDrawerOpen.set(true);
  }

  openRenewDrawer(row: GridRow): void {
    const raw = row['_raw'] as ContractItem;
    this.drawerActionType.set('renew');
    this.drawerTargetContractId.set(raw.contractId);
    this.formEmployeeId.set(raw.employeeId);
    this.formPosition.set(raw.position);
    this.formContractTypeId.set(raw.contractTypeId);
    this.formHourlyRate.set(raw.hourlyRate);
    this.formAllowance.set(raw.allowance);

    const baseDate = raw.endDate ? new Date(raw.endDate) : new Date();
    if (raw.endDate && !isNaN(baseDate.getTime())) {
      baseDate.setDate(baseDate.getDate() + 1);
    }
    const startIso = isNaN(baseDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : baseDate.toISOString().slice(0, 10);

    this.formStartDate.set(startIso);
    this.formEndDate.set(this.calcEndDate(raw.contractTypeId, startIso));
    this.formNote.set(`Gia hạn từ hợp đồng ${raw.contractCode}`);
    this.isCreateDrawerOpen.set(true);
  }

  onDrawerEmployeeChange(empIdStr: string): void {
    const empId = Number(empIdStr);
    this.formEmployeeId.set(empId);
    const emp = this.employees().find((e) => getEmployeeNumericId(e) === empId);
    if (emp) {
      this.formPosition.set(emp.position || '');
      if (emp.hourlyRate) this.formHourlyRate.set(emp.hourlyRate);
      if (emp.contractTypeId) {
        this.onDrawerContractTypeChange('' + emp.contractTypeId);
      }
    }
  }

  onDrawerContractTypeChange(typeIdStr: string): void {
    const typeId = Number(typeIdStr);
    this.formContractTypeId.set(typeId);
    const found = this.contractTypes().find((t) => t.contractTypeId === typeId);
    if (found) {
      if (found.standardHourlyRate > 0) this.formHourlyRate.set(found.standardHourlyRate);
      this.formAllowance.set(found.allowance || 0);
      this.formEndDate.set(this.calcEndDate(typeId, this.formStartDate()));
    }
  }

  onDrawerStartDateChange(dateStr: string): void {
    this.formStartDate.set(dateStr);
    this.formEndDate.set(this.calcEndDate(this.formContractTypeId(), dateStr));
  }

  submitCreateDrawer(): void {
    if (!this.formEmployeeId() || !this.formPosition().trim() || !this.formStartDate()) {
      this.toastService.warning('Vui lòng chọn nhân sự, chức vụ và ngày hiệu lực.');
      return;
    }

    this.isSubmitting.set(true);
    this.contractApi
      .submitContractChange({
        employeeId: this.formEmployeeId(),
        contractTypeId: this.formContractTypeId(),
        position: this.formPosition().trim(),
        hourlyRate: Number(this.formHourlyRate()) || 0,
        allowance: Number(this.formAllowance()) || 0,
        startDate: this.formStartDate(),
        endDate: this.formEndDate() || null,
        actionType: this.drawerActionType(),
        targetContractId: this.drawerTargetContractId(),
        note: this.formNote().trim() || null,
        autoApproveIfAllowed: this.isDirectApprover(),
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.isCreateDrawerOpen.set(false);
          this.toastService.success(res.message);
          this.loadContracts();
          this.loadSummary();
        },
        error: (err: Error) => {
          this.isSubmitting.set(false);
          this.toastService.error(err.message);
        },
      });
  }

  private calcEndDate(typeId: number, startDateStr: string): string {
    const found = this.contractTypes().find((t) => t.contractTypeId === typeId);
    if (!found || !found.durationMonths || !startDateStr) return '';
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + found.durationMonths);
    return d.toISOString().slice(0, 10);
  }

  private toIsoDate(raw?: string | null): string {
    if (!raw) return '';
    const s = String(raw);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  private formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('vi-VN');
  }

  // ---- Xuất Word (.docx) theo file mẫu ----
  exportWordRow(row: GridRow): void {
    const raw = row['_raw'] as ContractItem;
    this.contractApi.exportWord(raw.contractId).subscribe({
      next: (blob) => this.triggerBlobDownload(blob, `HopDong_${raw.employeeCode}_${raw.contractCode}.docx`),
      error: (err: Error) => this.toastService.error(err.message),
    });
  }

  // ---- Xuất Excel theo quy trình chuẩn (Modal xác nhận -> Tải file) ----
  openExportConfirm(): void {
    this.isExportConfirmOpen.set(true);
  }

  executeExportExcel(): void {
    this.isExportConfirmOpen.set(false);
    const rows = this.gridRows();
    if (rows.length === 0) {
      this.toastService.warning('Không có dữ liệu hợp đồng trên màn hình để xuất Excel.');
      return;
    }

    const cols = this.columns();
    const headers = cols.map((c) => c.label || c.key);
    const statusLabelMap: Record<string, string> = {
      pending: 'Chờ duyệt',
      active: 'Hiệu lực',
      expired: 'Hết hạn',
      terminated: 'Đã thanh lý',
      rejected: 'Từ chối',
    };

    const payloadRows = rows.map((r) => {
      const record: Record<string, unknown> = {};
      for (const c of cols) {
        const headerName = c.label || c.key;
        let val = r[c.key];
        if (c.key === 'startDate' && val) {
          val = this.formatDate(String(val));
        } else if (c.key === 'status') {
          val = statusLabelMap[String(val ?? '')] ?? String(val ?? '');
        } else if (c.key === 'hourlyRate' || c.key === 'allowance') {
          val = Number(val ?? 0);
        } else {
          val = val ?? '';
        }
        record[headerName] = val;
      }
      return record;
    });

    const titleMap: Record<ContractTabMode, string> = {
      current: 'DANH SÁCH HỢP ĐỒNG HIỆN TẠI',
      expiring: 'DANH SÁCH HỢP ĐỒNG ĐẾN HẠN KÝ',
      history: 'LỊCH SỬ KÝ HỢP ĐỒNG LAO ĐỘNG',
    };
    const mode = this.tabMode();
    const fileName = `Fiin_HRM_HopDong_${mode}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: `Fiin_HRM_Contracts_${mode}`,
        sheetName: 'Hợp đồng',
        reportTitle: titleMap[mode] ?? 'DANH SÁCH HỢP ĐỒNG',
        summaryLabel: 'Tổng số hợp đồng:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất ${rows.length} hợp đồng ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất file Excel hợp đồng.');
        },
      });
  }

  downloadImportTemplate(): void {
    this.contractApi.downloadImportTemplate().subscribe({
      next: (blob) => this.triggerBlobDownload(blob, 'Fiin_HRM_Contracts_Import_Template.xlsx'),
      error: () => this.toastService.error('Không thể tải file Excel mẫu.'),
    });
  }

  closeImportModal(): void {
    if (this.isImporting()) return;
    this.isImportModalOpen.set(false);
    this.importPreview.set(null);
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.selectedFileName.set(file.name);
    this.isUploading.set(true);
    this.uploadProgress.set(35);
    this.previewTab.set('all');

    this.contractApi.previewImportExcel(file).subscribe({
      next: (res) => {
        this.uploadProgress.set(100);
        setTimeout(() => {
          this.isUploading.set(false);
          this.importPreview.set(res);
          this.isImportModalOpen.set(true);
        }, 180);
      },
      error: (err: Error) => {
        this.isUploading.set(false);
        this.toastService.error(err.message);
      },
    });
  }

  confirmImportSave(): void {
    const preview = this.importPreview();
    if (!preview || preview.validRows === 0) {
      this.toastService.warning('Không có dòng hợp lệ để nhập.');
      return;
    }

    this.isImporting.set(true);
    this.contractApi.saveImportContracts(preview.items).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        this.isImportModalOpen.set(false);
        this.importPreview.set(null);
        this.toastService.success(res.message);
        this.loadContracts();
        this.loadSummary();
      },
      error: (err: Error) => {
        this.isImporting.set(false);
        this.toastService.error(err.message);
      },
    });
  }

  private triggerBlobDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
