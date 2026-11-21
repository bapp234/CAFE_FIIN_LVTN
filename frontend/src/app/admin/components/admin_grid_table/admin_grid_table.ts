import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  contentChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideInbox } from '@lucide/angular';

// ===========================================================================
// KIỂU DỮ LIỆU DÙNG CHUNG (export để các page / API service dùng lại)
// ===========================================================================

/** Một dòng dữ liệu bất kỳ. Khóa bắt đầu bằng "_" (vd: _raw) bị ẩn khỏi bảng. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GridRow = Record<string, any>;

export type GridCellType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'badge' // dùng badgeMap để đổi giá trị -> nhãn + màu
  | 'code' // mã dạng huy hiệu (vd: mã nhân viên)
  | 'pill'; // nhãn bo tròn (vd: chi nhánh)

export type GridAlign = 'left' | 'center' | 'right';
export type GridTone = 'muted' | 'success' | 'dark' | 'info';
export type GridBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type GridSortOrder = 'asc' | 'desc';
export type GridSummaryKind = 'sum' | 'avg' | 'count';

export interface GridBadge {
  label: string;
  variant: GridBadgeVariant;
}

/**
 * Mô tả một cột. Tất cả trường đều tùy chọn trừ `key`, nên proc / API chỉ cần
 * trả về mảng này (kèm dữ liệu) là bảng tự dựng đủ cột.
 */
export interface GridColumn {
  key: string;
  /** Tiêu đề; mặc định tự suy ra từ key (fullName -> "Full Name"). */
  label?: string;
  type?: GridCellType;
  align?: GridAlign;
  width?: string;
  minWidth?: string;
  sortable?: boolean;
  /** Khóa gửi đi khi sắp xếp, mặc định = key. */
  sortKey?: string;
  hidden?: boolean;
  mono?: boolean;
  bold?: boolean;
  strike?: boolean;
  tone?: GridTone;
  /** Tên trường trong dòng dữ liệu quy định tone riêng cho từng dòng. */
  toneKey?: string;
  /** Hậu tố sau giá trị, vd: ' ₫/h'. Mặc định ' ₫' cho type 'currency'. */
  suffix?: string;
  /** Dòng phụ nhỏ bên dưới giá trị chính (vd: "Vào làm: ..."). */
  subKey?: string;
  subPrefix?: string;
  subType?: GridCellType;
  /** Hiện giá trị tổng hợp ở hàng tổng kết chân bảng. */
  summary?: GridSummaryKind;
  /** Với type 'badge': giá trị -> nhãn + màu. */
  badgeMap?: Record<string, GridBadge>;
  /** Cờ cho phép nhập / chỉnh sửa dữ liệu trên cột này (Editable Column). Mặc định false. */
  editable?: boolean;
}

/** Gói trả về của proc / API: danh sách cột + dữ liệu. */
export interface GridDataset {
  columns: GridColumn[];
  rows: GridRow[];
}

export interface GridSort {
  key: string;
  order: GridSortOrder;
}

export interface GridActionsContext {
  $implicit: GridRow;
  index: number;
}

// ===========================================================================
// NỘI BỘ
// ===========================================================================

type ResolvedColumn = GridColumn & {
  label: string;
  type: GridCellType;
  align: GridAlign;
  mono: boolean;
};

interface ViewCell {
  col: ResolvedColumn;
  type: GridCellType;
  text: string;
  textClass: string;
  sub: string;
  badge: GridBadge | null;
}

interface ViewRow {
  row: GridRow;
  key: string;
  cells: ViewCell[];
}

interface SummaryModel {
  labelSpan: number;
  cells: { text: string; align: GridAlign }[];
}

const NUMERIC: GridCellType[] = ['number', 'currency', 'percent'];
const MONO: GridCellType[] = ['number', 'currency', 'percent', 'date', 'datetime', 'code'];
const CENTERED: GridCellType[] = ['date', 'datetime', 'boolean', 'badge', 'code'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

const pad = (n: number): string => String(n).padStart(2, '0');

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

function parseCssSizeToPx(raw: string | undefined, fallbackPx: number): number {
  if (!raw) return fallbackPx;
  const trimmed = raw.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (Number.isNaN(num) || num <= 0) return fallbackPx;
  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    return Math.round(num * 16);
  }
  if (trimmed.endsWith('px')) {
    return Math.round(num);
  }
  return fallbackPx;
}

/**
 * Bảng dữ liệu dùng chung cho toàn bộ trang admin.
 * Hỗ trợ:
 * - Kéo giãn độ rộng cột & chiều cao dòng kiểu bảng tính Excel (resizable = true)
 * - Ghim cố định N cột đầu tiên khi cuộn ngang (frozenCount = 3 mặc định)
 */
@Component({
  selector: 'app-admin-grid-table',
  templateUrl: './admin_grid_table.html',
  styleUrl: './admin_grid_table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgTemplateOutlet, LucideInbox],
})
export class AdminGridTableComponent {
  private readonly destroyRef = inject(DestroyRef);

  // ---- dữ liệu ----
  readonly rows = input<GridRow[]>([]);
  /** Bỏ trống thì tự sinh cột từ dữ liệu. */
  readonly columns = input<GridColumn[]>([]);
  /** Chỉ dùng khi tự sinh cột: các khóa không muốn hiển thị. */
  readonly hiddenKeys = input<string[]>([]);
  /** Tên trường định danh dòng (dùng cho chọn dòng và track). */
  readonly rowKey = input('id');

  // ---- trạng thái ----
  readonly loading = input(false);
  readonly selectedKey = input<string | number | null>(null);
  readonly selectedKeys = input<(string | number)[]>([]);
  /** Làm mờ toàn bộ dòng (vd: tab lưu trữ). */
  readonly muted = input(false);

  // ---- hiển thị ----
  readonly showIndex = input(true);
  readonly indexLabel = input('STT');
  readonly ariaLabel = input('');
  readonly maxHeight = input('');
  readonly loadingText = input('Đang tải dữ liệu...');
  readonly emptyTitle = input('Không có dữ liệu');
  readonly emptyDescription = input('');
  readonly actionsLabel = input('Thao tác');
  readonly actionsWidth = input('6.5rem');
  readonly stickyActions = input(false);
  /** Hiển thị đường kẻ dọc phân tách các cột giúp đối soát dễ nhìn hơn (mặc định: true). */
  readonly bordered = input(true);

  // ---- tính năng kiểu Excel: kéo giãn cột/dòng & cố định cột đầu/cuối ----
  /** Cho phép kéo giãn độ rộng cột và chiều cao dòng như Excel (mặc định: true). */
  readonly resizable = input(true);
  /** Số lượng cột đầu tiên được ghim cố định khi cuộn ngang (mặc định: 3 cột đầu tiên). */
  readonly frozenCount = input(3);
  /** Số lượng cột dữ liệu ở cuối bảng (bên trái cột Thao tác) được ghim cố định bên phải (mặc định: 0). */
  readonly frozenRightCount = input(0);

  // ---- tổng kết chân bảng ----
  readonly showSummary = input(false);
  readonly summaryLabel = input('');
  readonly showEndOfList = input(true);
  readonly endOfListText = input('- Đã hiển thị toàn bộ -');

  // ---- phân trang cuộn lười (Infinite Scroll / Lazy Load) ----
  readonly loadingMore = input(false);
  readonly loadingMoreText = input('Đang tải thêm 50 nhân sự tiếp theo...');
  readonly hasMore = input(false);

  // ---- sắp xếp ----
  readonly sortBy = input('');
  readonly sortOrder = input<GridSortOrder>('asc');
  /** true: bảng tự sắp xếp trên dữ liệu đang có. false: chỉ phát sự kiện, page tự gọi lại API. */
  readonly clientSort = input(false);

  readonly rowClick = output<GridRow>();
  readonly sortChange = output<GridSort>();
  readonly scrolledToBottom = output<void>();

  readonly actionsTpl = contentChild<TemplateRef<GridActionsContext>>('actions');

  /** Bản đồ các TemplateRef tùy biến theo key của cột (áp dụng khi cột có cờ editable: true hoặc custom cell). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly cellTemplates = input<Record<string, TemplateRef<any>>>({});

  private readonly localSort = signal<GridSort | null>(null);

  // ---- Trạng thái kéo giãn cột & dòng (Excel resize) ----
  readonly colWidths = signal<Record<string, number>>({});
  readonly rowHeights = signal<Record<string, number>>({});
  readonly resizingColKey = signal<string | null>(null);
  readonly resizingRowKey = signal<string | null>(null);
  private suppressNextSortClick = false;
  private activeCleanup: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.activeCleanup) {
        this.activeCleanup();
        this.activeCleanup = null;
      }
    });
  }

  // =========================================================================
  // CỘT & GHIM CỐ ĐỊNH 3 CỘT ĐẦU TIÊN (STICKY / FROZEN COLUMNS)
  // =========================================================================
  readonly resolvedColumns = computed<ResolvedColumn[]>(() => {
    const given = this.columns();
    const base = given.length ? given : this.inferColumns(this.rows(), this.hiddenKeys());
    return base.filter((c) => !c.hidden).map((c) => this.resolve(c));
  });

  readonly colSpan = computed(
    () => (this.showIndex() ? 1 : 0) + this.resolvedColumns().length + (this.actionsTpl() ? 1 : 0)
  );

  /** Độ rộng (px) của cột STT */
  readonly indexColWidthPx = computed<number>(() => {
    return this.colWidths()['__index'] ?? 48;
  });

  /** Độ rộng (px) cho từng cột dữ liệu để tính toán sticky left và resize */
  readonly dataColWidthsPx = computed<number[]>(() => {
    const cols = this.resolvedColumns();
    const custom = this.colWidths();
    return cols.map((col, idx) => {
      if (custom[col.key] !== undefined) {
        return custom[col.key];
      }
      const fallback = idx === 0 ? 112 : idx === 1 ? 216 : 140;
      return parseCssSizeToPx(col.width ?? col.minWidth, fallback);
    });
  });

  /** Số cột dữ liệu được ghim cố định (trừ cột STT nếu có) */
  readonly frozenDataColCount = computed<number>(() => {
    const totalFrozen = Math.max(0, this.frozenCount());
    if (totalFrozen === 0) return 0;
    return this.showIndex() ? Math.max(0, totalFrozen - 1) : totalFrozen;
  });

  /** Cột STT có được ghim cố định không */
  readonly isIndexFrozen = computed<boolean>(() => {
    return this.showIndex() && this.frozenCount() >= 1;
  });

  /** Cột STT có phải là cột ghim cuối cùng không */
  readonly isIndexFrozenLast = computed<boolean>(() => {
    return this.isIndexFrozen() && (this.frozenDataColCount() === 0 || this.resolvedColumns().length === 0);
  });

  /** Tọa độ left (px) cho từng cột dữ liệu được ghim */
  readonly frozenDataColLeftsPx = computed<number[]>(() => {
    const widths = this.dataColWidthsPx();
    const startLeft = this.isIndexFrozen() ? this.indexColWidthPx() : 0;
    const lefts: number[] = [];
    let acc = startLeft;
    for (let i = 0; i < widths.length; i++) {
      lefts.push(acc);
      acc += widths[i];
    }
    return lefts;
  });

  isDataColFrozen(colIndex: number): boolean {
    return colIndex < this.frozenDataColCount();
  }

  isDataColFrozenLast(colIndex: number): boolean {
    const count = Math.min(this.frozenDataColCount(), this.resolvedColumns().length);
    return count > 0 && colIndex === count - 1;
  }

  getDataColStickyLeft(colIndex: number): number | null {
    if (!this.isDataColFrozen(colIndex)) return null;
    return this.frozenDataColLeftsPx()[colIndex] ?? 0;
  }

  /** Trả về độ rộng (px) áp dụng cho cột dữ liệu nếu là cột ghim hoặc đã được người dùng kéo giãn */
  getAppliedColWidthPx(col: ResolvedColumn, colIndex: number): number | null {
    const custom = this.colWidths()[col.key];
    if (custom !== undefined) return custom;
    if (this.isDataColFrozen(colIndex) || this.isDataColFrozenRight(colIndex)) {
      return this.dataColWidthsPx()[colIndex];
    }
    return null;
  }

  /** Độ rộng (px) của cột Thao tác bên phải cùng */
  readonly actionsColWidthPx = computed<number>(() => {
    if (!this.actionsTpl()) return 0;
    return parseCssSizeToPx(this.actionsWidth(), 104);
  });

  /** Cột Thao tác có được ghim cố định bên phải không */
  readonly isActionsStickyRight = computed<boolean>(() => {
    return !!this.actionsTpl() && (this.stickyActions() || this.frozenRightCount() > 0);
  });

  /** Số cột dữ liệu ở cuối bảng được ghim cố định bên phải */
  readonly frozenRightDataColCount = computed<number>(() => {
    return Math.max(0, Math.min(this.frozenRightCount(), this.resolvedColumns().length));
  });

  /** Tọa độ right (px) cho từng cột dữ liệu được ghim bên phải */
  readonly frozenDataColRightsPx = computed<number[]>(() => {
    const widths = this.dataColWidthsPx();
    const len = widths.length;
    const rights: number[] = new Array(len).fill(0);
    let acc = this.isActionsStickyRight() ? this.actionsColWidthPx() : 0;
    for (let i = len - 1; i >= 0; i--) {
      rights[i] = acc;
      acc += widths[i];
    }
    return rights;
  });

  isDataColFrozenRight(colIndex: number): boolean {
    const count = this.frozenRightDataColCount();
    const len = this.resolvedColumns().length;
    return count > 0 && colIndex >= len - count;
  }

  isDataColFrozenRightFirst(colIndex: number): boolean {
    const count = this.frozenRightDataColCount();
    const len = this.resolvedColumns().length;
    return count > 0 && colIndex === len - count;
  }

  getDataColStickyRight(colIndex: number): number | null {
    if (!this.isDataColFrozenRight(colIndex)) return null;
    return this.frozenDataColRightsPx()[colIndex] ?? 0;
  }

  // =========================================================================
  // KÉO GIÃN ĐỘ RỘNG CỘT & CHIỀU CAO DÒNG (EXCEL RESIZING)
  // =========================================================================
  onColResizeStart(event: MouseEvent, colKey: string, fallbackWidthPx?: number): void {
    if (!this.resizable()) return;
    event.preventDefault();
    event.stopPropagation();

    const handleEl = event.target as HTMLElement | null;
    const thEl = handleEl?.closest('th');
    const startWidth =
      this.colWidths()[colKey] ??
      (thEl ? Math.round(thEl.getBoundingClientRect().width) : fallbackWidthPx ?? 140);
    const startX = event.clientX;

    this.resizingColKey.set(colKey);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const minW = colKey === '__index' ? 38 : 56;
      const nextWidth = Math.max(minW, Math.round(startWidth + deltaX));
      this.colWidths.update((prev) => ({ ...prev, [colKey]: nextWidth }));
    };

    const onMouseUp = () => {
      this.resizingColKey.set(null);
      this.suppressNextSortClick = true;
      setTimeout(() => {
        this.suppressNextSortClick = false;
      }, 80);
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (this.activeCleanup === cleanup) {
        this.activeCleanup = null;
      }
    };

    if (this.activeCleanup) this.activeCleanup();
    this.activeCleanup = cleanup;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  onColResizeReset(event: MouseEvent, colKey: string): void {
    if (!this.resizable()) return;
    event.preventDefault();
    event.stopPropagation();
    this.colWidths.update((prev) => {
      const copy = { ...prev };
      delete copy[colKey];
      return copy;
    });
  }

  onRowResizeStart(event: MouseEvent, rowKey: string): void {
    if (!this.resizable()) return;
    event.preventDefault();
    event.stopPropagation();

    const handleEl = event.target as HTMLElement | null;
    const trEl = handleEl?.closest('tr');
    const startHeight =
      this.rowHeights()[rowKey] ??
      (trEl ? Math.round(trEl.getBoundingClientRect().height) : 38);
    const startY = event.clientY;

    this.resizingRowKey.set(rowKey);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const nextHeight = Math.max(28, Math.round(startHeight + deltaY));
      this.rowHeights.update((prev) => ({ ...prev, [rowKey]: nextHeight }));
    };

    const onMouseUp = () => {
      this.resizingRowKey.set(null);
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (this.activeCleanup === cleanup) {
        this.activeCleanup = null;
      }
    };

    if (this.activeCleanup) this.activeCleanup();
    this.activeCleanup = cleanup;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  onRowResizeReset(event: MouseEvent, rowKey: string): void {
    if (!this.resizable()) return;
    event.preventDefault();
    event.stopPropagation();
    this.rowHeights.update((prev) => {
      const copy = { ...prev };
      delete copy[rowKey];
      return copy;
    });
  }

  // =========================================================================
  // DÒNG
  // =========================================================================
  readonly activeSort = computed<GridSort | null>(() => {
    if (this.clientSort()) return this.localSort();
    return this.sortBy() ? { key: this.sortBy(), order: this.sortOrder() } : null;
  });

  private readonly sortedRows = computed<GridRow[]>(() => {
    const rows = this.rows();
    const sort = this.clientSort() ? this.localSort() : null;
    if (!sort) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (isEmpty(va) && isEmpty(vb)) return 0;
      if (isEmpty(va)) return 1;
      if (isEmpty(vb)) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'vi', { numeric: true }) * dir;
    });
  });

  readonly viewRows = computed<ViewRow[]>(() => {
    const cols = this.resolvedColumns();
    const keyField = this.rowKey();
    return this.sortedRows().map((row, i) => ({
      row,
      key: isEmpty(row[keyField]) ? `__${i}` : String(row[keyField]),
      cells: cols.map((c) => this.buildCell(row, c)),
    }));
  });

  readonly selectedKeyStr = computed(() =>
    this.selectedKey() === null ? null : String(this.selectedKey())
  );

  readonly selectedKeySet = computed(() => {
    const set = new Set<string>();
    const single = this.selectedKey();
    if (single !== null && single !== undefined) set.add(String(single));
    for (const k of this.selectedKeys()) {
      if (k !== null && k !== undefined) set.add(String(k));
    }
    return set;
  });

  onViewportScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el || this.loading() || this.loadingMore() || !this.hasMore()) return;

    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom <= 80) {
      this.scrolledToBottom.emit();
    }
  }

  onRowClicked(event: MouseEvent, row: GridRow): void {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.closest('input') ||
        target.closest('select') ||
        target.closest('button') ||
        target.closest('textarea') ||
        target.closest('.gt-editable') ||
        target.closest('.cell-excel-wrap') ||
        target.closest('.gt-row-resizer'))
    ) {
      return;
    }
    this.rowClick.emit(row);
  }

  isRowSelected(key: string): boolean {
    return this.selectedKeySet().has(key);
  }

  // =========================================================================
  // HÀNG TỔNG KẾT
  // =========================================================================
  readonly summary = computed<SummaryModel | null>(() => {
    if (!this.showSummary()) return null;
    const cols = this.resolvedColumns();
    const first = cols.findIndex((c) => !!c.summary);
    const lead = (this.showIndex() ? 1 : 0) + (first < 0 ? cols.length : first);
    if (first < 0) return { labelSpan: this.colSpan(), cells: [] };

    const rows = this.rows();
    const cells = cols.slice(first).map((c) => ({
      text: c.summary ? this.aggregate(rows, c) : '',
      align: c.align,
    }));
    if (this.actionsTpl()) cells.push({ text: '', align: 'center' });
    return { labelSpan: lead, cells };
  });

  // =========================================================================
  // SỰ KIỆN
  // =========================================================================
  onSort(col: ResolvedColumn): void {
    if (this.suppressNextSortClick || !col.sortable) return;
    const key = col.sortKey ?? col.key;
    const current = this.activeSort();
    const order: GridSortOrder = current?.key === key && current.order === 'asc' ? 'desc' : 'asc';
    const next: GridSort = { key, order };
    if (this.clientSort()) this.localSort.set(next);
    this.sortChange.emit(next);
  }

  sortIcon(col: ResolvedColumn): string {
    const s = this.activeSort();
    if (!s || s.key !== (col.sortKey ?? col.key)) return '⇅';
    return s.order === 'asc' ? '▲' : '▼';
  }

  ariaSort(col: ResolvedColumn): 'ascending' | 'descending' | null {
    const s = this.activeSort();
    if (!col.sortable || !s || s.key !== (col.sortKey ?? col.key)) return null;
    return s.order === 'asc' ? 'ascending' : 'descending';
  }

  // =========================================================================
  // XỬ LÝ NỘI BỘ
  // =========================================================================
  private inferColumns(rows: GridRow[], hidden: string[]): GridColumn[] {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]).filter((k) => !k.startsWith('_') && !hidden.includes(k));
    return keys.map((key) => {
      const sample = rows.find((r) => !isEmpty(r[key]))?.[key];
      return { key, label: humanize(key), type: this.inferType(sample), sortable: true };
    });
  }

  private inferType(v: unknown): GridCellType {
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (v instanceof Date) return 'datetime';
    if (typeof v === 'string') {
      if (ISO_DATETIME.test(v)) return 'datetime';
      if (ISO_DATE.test(v)) return 'date';
    }
    return 'text';
  }

  private resolve(c: GridColumn): ResolvedColumn {
    const type = c.type ?? 'text';
    return {
      ...c,
      label: c.label ?? humanize(c.key),
      type,
      align: c.align ?? (NUMERIC.includes(type) ? 'right' : CENTERED.includes(type) ? 'center' : 'left'),
      mono: c.mono ?? MONO.includes(type),
    };
  }

  private buildCell(row: GridRow, col: ResolvedColumn): ViewCell {
    const raw = row[col.key];

    if (isEmpty(raw)) {
      return { col, type: 'text', text: '—', textClass: 'gt-text gt-tone-muted', sub: '', badge: null };
    }

    if (col.type === 'badge') {
      const badge = col.badgeMap?.[String(raw)] ?? { label: String(raw), variant: 'neutral' as const };
      return { col, type: 'badge', text: badge.label, textClass: '', sub: '', badge };
    }

    const tone = col.toneKey ? row[col.toneKey] : col.tone;
    const textClass = [
      'gt-text',
      col.mono && col.type !== 'code' ? 'gt-mono' : '',
      col.bold ? 'gt-bold' : '',
      col.strike ? 'gt-strike' : '',
      tone ? `gt-tone-${tone}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const subRaw = col.subKey ? row[col.subKey] : null;
    const sub = isEmpty(subRaw)
      ? ''
      : (col.subPrefix ?? '') + this.format(subRaw, col.subType ?? 'text', undefined);

    return {
      col,
      type: col.type,
      text: this.format(raw, col.type, col.suffix),
      textClass,
      sub,
      badge: null,
    };
  }

  private format(value: unknown, type: GridCellType, suffix: string | undefined): string {
    switch (type) {
      case 'number':
      case 'currency':
      case 'percent': {
        const n = Number(value);
        if (Number.isNaN(n)) return String(value);
        const unit = suffix ?? (type === 'currency' ? ' ₫' : type === 'percent' ? '%' : '');
        return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + unit;
      }
      case 'date':
        return this.formatDate(value, false);
      case 'datetime':
        return this.formatDate(value, true);
      case 'boolean':
        return value ? 'Có' : 'Không';
      default:
        return String(value) + (suffix ?? '');
    }
  }

  private formatDate(value: unknown, withTime: boolean): string {
    let d: Date | null = null;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'string') {
      if (ISO_DATE.test(value)) {
        const [y, m, day] = value.split('-').map(Number);
        d = new Date(y, m - 1, day);
      } else if (ISO_DATETIME.test(value)) {
        d = new Date(value);
      }
    }
    if (!d || Number.isNaN(d.getTime())) return String(value);
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
  }

  private aggregate(rows: GridRow[], col: ResolvedColumn): string {
    const nums = rows.map((r) => Number(r[col.key])).filter((n) => !Number.isNaN(n));
    const unit = col.suffix ?? (col.type === 'currency' ? ' ₫' : col.type === 'percent' ? '%' : '');
    const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + unit;

    switch (col.summary) {
      case 'sum':
        return 'Σ ' + fmt(nums.reduce((a, b) => a + b, 0));
      case 'avg':
        return 'TB: ' + fmt(nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0);
      case 'count':
        return String(rows.filter((r) => !isEmpty(r[col.key])).length);
      default:
        return '';
    }
  }
}
