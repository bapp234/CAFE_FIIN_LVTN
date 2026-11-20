import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideMail,
  LucidePhone,
  LucideRotateCcw,
  LucideShoppingCart,
  LucideTruck,
} from '@lucide/angular';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { AdminSearchBoxComponent } from '../../../components/admin_search_box/admin_search_box';
import { ErpApi } from '../services/erp_api';
import { Supplier } from '../models/erp_models';

@Component({
  selector: 'app-erp-suppliers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideMail,
    LucidePhone,
    LucideRotateCcw,
    LucideShoppingCart,
    LucideTruck,
    AdminButtonComponent,
    AdminSearchBoxComponent,
  ],
  templateUrl: './erp_suppliers.html',
  styleUrl: './erp_suppliers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpSuppliers {
  private readonly erpApi = inject(ErpApi);
  private readonly toast = inject(AdminToastService);

  readonly isLoading = signal(false);
  readonly suppliers = signal<Supplier[]>([]);
  readonly searchQuery = signal('');

  readonly filteredSuppliers = computed(() => {
    const list = this.suppliers();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return list;

    return list.filter((s) => {
      const mCode = s.code.toLowerCase().includes(q);
      const mName = s.name.toLowerCase().includes(q);
      const mContact = s.contactPerson.toLowerCase().includes(q);
      const mPhone = s.phone.toLowerCase().includes(q);
      return mCode || mName || mContact || mPhone;
    });
  });

  readonly totalDebt = computed(() => {
    return this.suppliers().reduce((sum, s) => sum + s.currentDebt, 0);
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.erpApi.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('vi-VN') + ' ₫';
  }

  openCreatePo(supplier: Supplier): void {
    this.toast.info(`Mở biểu mẫu tạo đơn đặt hàng mới cho NCC [${supplier.name}]`);
  }
}
