import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideCoffee,
  LucideRotateCcw,
  LucideSliders,
} from '@lucide/angular';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../components/admin_combo_box/admin_combo_box';
import { AdminSearchBoxComponent } from '../../../components/admin_search_box/admin_search_box';
import { ErpApi } from '../services/erp_api';
import { ProductMenuItem } from '../models/erp_models';

@Component({
  selector: 'app-erp-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCoffee,
    LucideRotateCcw,
    LucideSliders,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminSearchBoxComponent,
  ],
  templateUrl: './erp_products.html',
  styleUrl: './erp_products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpProducts {
  private readonly erpApi = inject(ErpApi);
  private readonly toast = inject(AdminToastService);

  readonly isLoading = signal(false);
  readonly menuItems = signal<ProductMenuItem[]>([]);
  readonly searchQuery = signal('');
  readonly categoryFilter = signal('all');

  readonly categoryOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả nhóm món' },
    { value: 'coffee_traditional', label: 'Cà phê truyền thống' },
    { value: 'coffee_espresso', label: 'Cà phê pha máy' },
    { value: 'tea', label: 'Trà & Macchiato' },
    { value: 'bakery', label: 'Bánh tươi & Điểm tâm' },
  ];

  readonly filteredItems = computed(() => {
    const list = this.menuItems();
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.categoryFilter();

    return list.filter((item) => {
      if (cat !== 'all' && item.category !== cat) return false;
      if (q) {
        const mCode = item.code.toLowerCase().includes(q);
        const mName = item.name.toLowerCase().includes(q);
        const mCat = item.categoryName.toLowerCase().includes(q);
        if (!mCode && !mName && !mCat) return false;
      }
      return true;
    });
  });

  readonly totalMenuCount = computed(() => this.menuItems().length);
  readonly activeMenuCount = computed(() => this.menuItems().filter((m) => m.status === 'active').length);

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.erpApi.getMenuItems().subscribe({
      next: (data) => {
        this.menuItems.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('vi-VN') + ' ₫';
  }

  editRecipe(item: ProductMenuItem): void {
    this.toast.info(`Mở điều chỉnh định lượng trừ kho (Recipe) cho món [${item.name}]`);
  }
}
