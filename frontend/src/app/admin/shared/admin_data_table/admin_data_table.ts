import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  computed,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAlertCircle,
  LucideArrowDown,
  LucideArrowUp,
  LucideArrowUpDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideInbox,
} from '@lucide/angular';
import { SortDirection, TableColumn } from '../models/page';

@Component({
  selector: 'app-admin-data-table',
  templateUrl: './admin_data_table.html',
  styleUrl: './admin_data_table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideArrowUpDown,
    LucideArrowUp,
    LucideArrowDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideInbox,
    LucideAlertCircle,
  ],
})
export class AdminDataTable {
  /** Template tùy biến cho từng dòng nếu có */
  @ContentChild('rowTemplate') rowTemplate?: TemplateRef<any>;

  readonly columns = input.required<TableColumn[]>();
  readonly items = input.required<any[]>();
  readonly total = input<number>(0);
  readonly page = input<number>(1);
  readonly size = input<number>(10);
  readonly isLoading = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly sortBy = input<string>('');
  readonly sortOrder = input<SortDirection>('asc');
  readonly emptyMessage = input<string>('Không có dữ liệu nào phù hợp.');
  readonly selectable = input<boolean>(false);
  readonly selectedIds = input<string[]>([]);

  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();
  readonly sortChange = output<{ key: string; order: SortDirection }>();
  readonly rowClick = output<any>();
  readonly selectionChange = output<string[]>();

  readonly totalPages = computed(() => {
    const t = this.total();
    const s = this.size();
    return Math.max(1, Math.ceil(t / s));
  });

  readonly startItemIndex = computed(() => {
    if (this.total() === 0) return 0;
    return (this.page() - 1) * this.size() + 1;
  });

  readonly endItemIndex = computed(() => {
    return Math.min(this.page() * this.size(), this.total());
  });

  readonly isAllSelected = computed(() => {
    const list = this.items();
    if (!list.length) return false;
    const selected = new Set(this.selectedIds());
    return list.every((item) => selected.has(item.id));
  });

  onSort(key: string, isSortable?: boolean): void {
    if (!isSortable) return;
    const currentKey = this.sortBy();
    const currentOrder = this.sortOrder();

    let newOrder: SortDirection = 'asc';
    if (currentKey === key) {
      newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    }
    this.sortChange.emit({ key, order: newOrder });
  }

  onPageSelect(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages() || newPage === this.page()) return;
    this.pageChange.emit(newPage);
  }

  onSizeSelect(event: Event): void {
    const newSize = Number((event.target as HTMLSelectElement).value);
    this.sizeChange.emit(newSize);
  }

  toggleSelectAll(): void {
    const allSelected = this.isAllSelected();
    if (allSelected) {
      this.selectionChange.emit([]);
    } else {
      const allIds = this.items().map((item) => item.id);
      this.selectionChange.emit(allIds);
    }
  }

  toggleSelectItem(id: string, event: Event): void {
    event.stopPropagation();
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectionChange.emit(Array.from(current));
  }

  isItemSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }
}
