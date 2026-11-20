import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideBuilding,
  LucideRotateCcw,
  LucideSliders,
  LucideWarehouse,
} from '@lucide/angular';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../components/admin_combo_box/admin_combo_box';
import { AdminSearchBoxComponent } from '../../../components/admin_search_box/admin_search_box';
import { ErpApi } from '../services/erp_api';
import { InventoryItem } from '../models/erp_models';

@Component({
  selector: 'app-erp-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideBuilding,
    LucideRotateCcw,
    LucideSliders,
    LucideWarehouse,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminSearchBoxComponent,
  ],
  templateUrl: './erp_inventory.html',
  styleUrl: './erp_inventory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpInventory {
  readonly branchService = inject(AdminBranchService);
  private readonly erpApi = inject(ErpApi);
  private readonly toast = inject(AdminToastService);

  readonly isLoading = signal(false);
  readonly items = signal<InventoryItem[]>([]);
  readonly searchQuery = signal('');
  readonly categoryFilter = signal('all');
  readonly statusFilter = signal('all');

  readonly categoryOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả nhóm nguyên liệu' },
    { value: 'coffee', label: 'Cà phê hạt mộc' },
    { value: 'milk', label: 'Sữa & Kem béo' },
    { value: 'syrup', label: 'Đường, Syrup & Trà' },
    { value: 'packaging', label: 'Bao bì & Vật tư' },
  ];

  readonly statusOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'in_stock', label: 'Đủ hàng' },
    { value: 'low_stock', label: 'Sắp hết' },
    { value: 'out_of_stock', label: 'Hết hàng' },
  ];

  readonly filteredItems = computed(() => {
    const list = this.items();
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.categoryFilter();
    const st = this.statusFilter();

    return list.filter((item) => {
      if (cat !== 'all' && item.category !== cat) return false;
      if (st !== 'all' && item.status !== st) return false;
      if (q) {
        const matchCode = item.code.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.categoryName.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCat) return false;
      }
      return true;
    });
  });

  readonly totalValue = computed(() => {
    return this.filteredItems().reduce((sum, i) => sum + i.currentStock * i.costPrice, 0);
  });

  readonly inStockCount = computed(() => this.items().filter((i) => i.status === 'in_stock').length);
  readonly lowStockCount = computed(() => this.items().filter((i) => i.status === 'low_stock').length);
  readonly outOfStockCount = computed(() => this.items().filter((i) => i.status === 'out_of_stock').length);

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.erpApi.getInventoryItems().subscribe({
      next: (data) => {
        this.items.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('vi-VN') + ' ₫';
  }

  quickAdjustStock(item: InventoryItem): void {
    this.toast.info(`Mở phiếu điều chỉnh tồn kho cho [${item.name}]`);
  }
}
