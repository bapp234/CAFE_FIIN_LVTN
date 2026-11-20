import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucidePlus,
  LucideRotateCcw,
  LucideSave,
  LucideTrash2,
} from '@lucide/angular';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { ContractType } from '../../../models/employee';
import { HrmContractApi } from '../../../services/hrm_contract_api';

interface EditableContractTypeRow extends ContractType {
  _rowKey: string;
  _dirty?: boolean;
  _isNew?: boolean;
}

@Component({
  selector: 'app-contract-settings-tab',
  templateUrl: './contract_settings.html',
  styleUrl: './contract_settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCheck,
    LucidePlus,
    LucideRotateCcw,
    LucideSave,
    LucideTrash2,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
  ],
})
export class ContractSettingsTab implements OnInit {
  private readonly contractApi = inject(HrmContractApi);
  private readonly toastService = inject(AdminToastService);

  readonly searchQuery = signal('');
  readonly isLoading = signal(false);
  readonly isSavingAll = signal(false);
  readonly rowsState = signal<EditableContractTypeRow[]>([]);

  private readonly tplCode = viewChild<TemplateRef<unknown>>('tplCode');
  private readonly tplName = viewChild<TemplateRef<unknown>>('tplName');
  private readonly tplRate = viewChild<TemplateRef<unknown>>('tplRate');
  private readonly tplAllow = viewChild<TemplateRef<unknown>>('tplAllow');
  private readonly tplPct = viewChild<TemplateRef<unknown>>('tplPct');
  private readonly tplMonths = viewChild<TemplateRef<unknown>>('tplMonths');
  private readonly tplActive = viewChild<TemplateRef<unknown>>('tplActive');

  readonly cellTemplates = computed<Record<string, TemplateRef<unknown>>>(() => {
    const map: Record<string, TemplateRef<unknown>> = {};
    if (this.tplCode()) map['contractCode'] = this.tplCode()!;
    if (this.tplName()) map['contractName'] = this.tplName()!;
    if (this.tplRate()) map['standardHourlyRate'] = this.tplRate()!;
    if (this.tplAllow()) map['allowance'] = this.tplAllow()!;
    if (this.tplPct()) map['salaryPercentage'] = this.tplPct()!;
    if (this.tplMonths()) map['durationMonths'] = this.tplMonths()!;
    if (this.tplActive()) map['isActive'] = this.tplActive()!;
    return map;
  });

  readonly dirtyCount = computed(() => this.rowsState().filter((r) => r._dirty).length);

  readonly columns: GridColumn[] = [
    { key: 'contractCode', label: 'Mã loại HĐ', type: 'code', width: '9.5rem', editable: true },
    { key: 'contractName', label: 'Tên loại hợp đồng', type: 'text', minWidth: '16rem', editable: true },
    { key: 'standardHourlyRate', label: 'Lương giờ (₫)', type: 'number', align: 'right', width: '8.5rem', editable: true },
    { key: 'allowance', label: 'Phụ cấp (₫)', type: 'number', align: 'right', width: '8.5rem', editable: true },
    { key: 'salaryPercentage', label: 'Tỷ lệ (%)', type: 'number', align: 'right', width: '6.5rem', editable: true },
    { key: 'durationMonths', label: 'Thời hạn (tháng)', type: 'number', align: 'center', width: '8rem', editable: true },
    { key: 'isActive', label: 'Áp dụng', type: 'boolean', align: 'center', width: '6.5rem', editable: true },
  ];

  readonly gridRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();
    return this.rowsState()
      .filter(
        (t) =>
          t._isNew ||
          !kw ||
          t.contractCode.toLowerCase().includes(kw) ||
          t.contractName.toLowerCase().includes(kw)
      )
      .map((t) => ({
        _raw: t,
        _rowKey: t._rowKey,
        _dirty: !!t._dirty,
        contractTypeId: t.contractTypeId,
        contractCode: t.contractCode,
        contractName: t.contractName,
        standardHourlyRate: t.standardHourlyRate,
        allowance: t.allowance,
        salaryPercentage: t.salaryPercentage,
        durationMonths: t.durationMonths,
        isActive: t.isActive,
      }));
  });

  ngOnInit(): void {
    this.loadTypes();
  }

  loadTypes(): void {
    this.isLoading.set(true);
    this.contractApi.getContractTypes().subscribe({
      next: (list) => {
        this.rowsState.set(
          list.map((t) => ({
            ...t,
            _rowKey: `ct-${t.contractTypeId}`,
            _dirty: false,
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
  }

  addInlineRow(): void {
    const newRow: EditableContractTypeRow = {
      contractTypeId: 0,
      contractCode: '',
      contractName: '',
      standardHourlyRate: 28000,
      allowance: 0,
      salaryPercentage: 100,
      durationMonths: 12,
      benefitsDescription: '',
      isActive: true,
      _rowKey: `new-${Date.now()}`,
      _dirty: true,
      _isNew: true,
    };
    this.rowsState.update((list) => [newRow, ...list]);
  }

  patchCell(row: GridRow, field: keyof ContractType, value: unknown): void {
    const key = row['_rowKey'] as string;
    this.rowsState.update((list) =>
      list.map((item) =>
        item._rowKey === key
          ? { ...item, [field]: value, _dirty: true }
          : item
      )
    );
  }

  saveRow(row: GridRow): void {
    const raw = row['_raw'] as EditableContractTypeRow;
    if (!raw.contractCode.trim() || !raw.contractName.trim()) {
      this.toastService.warning('Vui lòng nhập đầy đủ mã và tên loại hợp đồng.');
      return;
    }

    this.contractApi
      .saveContractType({
        contractTypeId: raw._isNew ? null : raw.contractTypeId,
        contractCode: raw.contractCode.trim(),
        contractName: raw.contractName.trim(),
        standardHourlyRate: Number(raw.standardHourlyRate) || 0,
        allowance: Number(raw.allowance) || 0,
        salaryPercentage: Number(raw.salaryPercentage) || 100,
        durationMonths: raw.durationMonths ? Number(raw.durationMonths) : null,
        benefitsDescription: raw.benefitsDescription || null,
        isActive: raw.isActive,
      })
      .subscribe({
        next: () => {
          this.toastService.success(`Đã lưu loại hợp đồng ${raw.contractCode.toUpperCase()}.`);
          this.loadTypes();
        },
        error: (err: Error) => this.toastService.error(err.message),
      });
  }

  deleteRow(row: GridRow): void {
    const raw = row['_raw'] as EditableContractTypeRow;
    if (raw._isNew) {
      this.rowsState.update((list) => list.filter((i) => i._rowKey !== raw._rowKey));
      return;
    }
    this.contractApi.deleteContractType(raw.contractTypeId).subscribe({
      next: (msg) => {
        this.toastService.success(msg);
        this.loadTypes();
      },
      error: (err: Error) => this.toastService.error(err.message),
    });
  }
}
