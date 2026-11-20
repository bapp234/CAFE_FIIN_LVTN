import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideFileText,
  LucideRotateCcw,
} from '@lucide/angular';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../components/admin_combo_box/admin_combo_box';
import { AdminSearchBoxComponent } from '../../../components/admin_search_box/admin_search_box';
import { ErpApi } from '../services/erp_api';
import { PurchaseOrder } from '../models/erp_models';

@Component({
  selector: 'app-erp-purchasing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideFileText,
    LucideRotateCcw,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminSearchBoxComponent,
  ],
  templateUrl: './erp_purchasing.html',
  styleUrl: './erp_purchasing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPurchasing {
  private readonly erpApi = inject(ErpApi);
  private readonly toast = inject(AdminToastService);

  readonly isLoading = signal(false);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal('all');

  readonly statusOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả trạng thái PO' },
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'shipping', label: 'Đang giao hàng' },
    { value: 'completed', label: 'Đã nhập kho' },
    { value: 'cancelled', label: 'Đã hủy' },
  ];

  readonly filteredOrders = computed(() => {
    const list = this.orders();
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.statusFilter();

    return list.filter((po) => {
      if (st !== 'all' && po.status !== st) return false;
      if (q) {
        const mCode = po.poCode.toLowerCase().includes(q);
        const mSup = po.supplierName.toLowerCase().includes(q);
        const mNote = (po.note || '').toLowerCase().includes(q);
        if (!mCode && !mSup && !mNote) return false;
      }
      return true;
    });
  });

  readonly pendingCount = computed(() => this.orders().filter((o) => o.status === 'pending').length);
  readonly shippingCount = computed(() => this.orders().filter((o) => o.status === 'shipping').length);
  readonly completedCount = computed(() => this.orders().filter((o) => o.status === 'completed').length);
  readonly totalSpending = computed(() => {
    return this.orders()
      .filter((o) => o.status === 'completed' || o.status === 'shipping')
      .reduce((sum, o) => sum + o.totalAmount, 0);
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.erpApi.getPurchaseOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('vi-VN') + ' ₫';
  }

  openCreateOrderModal(): void {
    this.toast.info('Mở biểu mẫu lập đơn đặt mua hàng PO mới');
  }

  viewPoDetail(po: PurchaseOrder): void {
    this.toast.info(`Xem chi tiết phiếu mua hàng [${po.poCode}]`);
  }
}
