import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideRotateCcw, LucideSearch, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-admin-filter-bar',
  templateUrl: './admin_filter_bar.html',
  styleUrl: './admin_filter_bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideSearch, LucideX, LucideRotateCcw],
})
export class AdminFilterBar {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly placeholder = input<string>('Tìm kiếm theo tên, mã...');
  readonly showSearch = input<boolean>(true);
  readonly searchValue = input<string>('');
  readonly hasActiveFilters = input<boolean>(false);

  readonly searchChange = output<string>();
  readonly reset = output<void>();

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchChange.emit(val);
    this.syncQueryParam({ q: val || null, page: 1 });
  }

  onClearSearch(): void {
    this.searchChange.emit('');
    this.syncQueryParam({ q: null, page: 1 });
  }

  onResetFilters(): void {
    this.reset.emit();
    this.syncQueryParam({ q: null, page: 1 });
  }

  /**
   * Lưu các tham số lọc vào query param của URL
   */
  syncQueryParam(params: Record<string, any>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }
}
