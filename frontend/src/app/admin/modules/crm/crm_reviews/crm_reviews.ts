import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideDownload, LucideRotateCcw, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../components/admin_combo_box/admin_combo_box';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
} from '../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../components/admin_search_box/admin_search_box';
import { AdminToastService } from '../../../shared/services/admin_toast_service';

export interface EditableReviewRow {
  reviewId: number;
  customerName: string;
  phoneNumber: string;
  productName: string;
  rating: number;
  comment: string;
  adminReply: string;
  isVisible: boolean;
  createdAt: string;
  _isDirty: boolean;
}

interface ApiResponseDto<T> {
  success: boolean;
  data?: T;
}

@Component({
  selector: 'app-crm-reviews',
  templateUrl: './crm_reviews.html',
  styleUrl: './crm_reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideCheck,
    LucideDownload,
    LucideRotateCcw,
    LucideX,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
  ],
})
export class CrmReviews implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/reviews';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly ratingFilter = signal('');
  readonly visibleFilter = signal('');
  readonly sortOrder = signal('newest');

  readonly rows = signal<EditableReviewRow[]>([]);
  readonly isLoading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly isSaving = signal(false);
  readonly isExporting = signal(false);

  readonly ratingOptions: ComboOption[] = [
    { value: '', label: 'Tất cả số sao' },
    { value: '5', label: '5 sao' },
    { value: '4', label: '4 sao' },
    { value: '3', label: '3 sao' },
    { value: '2', label: '2 sao' },
    { value: '1', label: '1 sao' },
  ];

  readonly visibleOptions: ComboOption[] = [
    { value: '', label: 'Tất cả hiển thị' },
    { value: 'true', label: 'Đang hiển thị' },
    { value: 'false', label: 'Đang ẩn' },
  ];

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'reviewId', label: 'Mã ĐG', type: 'code', width: '85px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '170px', bold: true },
    { key: 'productName', label: 'Sản phẩm / Dịch vụ', minWidth: '170px' },
    { key: 'rating', label: 'Số sao', type: 'number', align: 'center', width: '85px', suffix: ' ★' },
    { key: 'comment', label: 'Nội dung khách đánh giá', minWidth: '240px' },
    { key: 'adminReply', label: 'Phản hồi của quán', minWidth: '240px', editable: true },
    { key: 'isVisible', label: 'Hiển thị', align: 'center', width: '85px', editable: true },
    { key: 'createdAt', label: 'Ngày đánh giá', type: 'datetime', width: '150px', align: 'center' },
  ];

  readonly gridRows = computed(() =>
    this.rows().map((item) => ({ ...item, _raw: item }) as GridRow),
  );

  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableReviewRow {
    return row['_raw'] as EditableReviewRow;
  }

  markDirty(item: EditableReviewRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  private buildParams(offset: number, limit: number): HttpParams {
    let params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit))
      .set('sortOrder', this.sortOrder());

    if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
    if (this.ratingFilter()) params = params.set('rating', this.ratingFilter());
    if (this.visibleFilter()) params = params.set('isVisible', this.visibleFilter());
    return params;
  }

  private mapRows(data: Record<string, unknown>[]): EditableReviewRow[] {
    return data.map((r) => ({
      reviewId: Number(r['reviewId']),
      customerName: String(r['customerName'] ?? ''),
      phoneNumber: String(r['phoneNumber'] ?? ''),
      productName: String(r['productName'] ?? ''),
      rating: Number(r['rating'] ?? 5),
      comment: String(r['comment'] ?? ''),
      adminReply: String(r['adminReply'] ?? ''),
      isVisible: Boolean(r['isVisible']),
      createdAt: String(r['createdAt'] ?? ''),
      _isDirty: false,
    }));
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    this.hasMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, {
          params: this.buildParams(0, 50),
          withCredentials: true,
        }),
      );
      const list = this.mapRows(res.data ?? []);
      this.rows.set(list);
      this.hasMore.set(list.length === 50);
    } catch {
      this.toast.error('Không thể tải danh sách đánh giá.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore() || this.isLoading()) return;
    this.loadingMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, {
          params: this.buildParams(this.rows().length, 10),
          withCredentials: true,
        }),
      );
      const next = this.mapRows(res.data ?? []);
      this.rows.update((list) => [...list, ...next]);
      this.hasMore.set(next.length === 10);
    } catch {
      this.toast.error('Không thể tải thêm đánh giá.');
    } finally {
      this.loadingMore.set(false);
    }
  }

  discardChanges(): void {
    void this.refreshTab();
  }

  async saveAllChanges(): Promise<void> {
    const toSave = this.dirtyRows();
    if (toSave.length === 0) return;

    this.isSaving.set(true);
    try {
      await Promise.all(
        toSave.map((item) =>
          firstValueFrom(
            this.http.post(
              `${this.apiUrl}/reply`,
              {
                reviewId: item.reviewId,
                adminReply: item.adminReply.trim() || null,
                isVisible: item.isVisible,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} phản hồi đánh giá.`);
      await this.refreshTab();
    } catch {
      this.toast.error('Lưu phản hồi đánh giá thất bại.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) {
      this.toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }

    this.isExporting.set(true);
    try {
      const headers = ['Mã ĐG', 'Khách hàng', 'Sản phẩm', 'Số sao', 'Nội dung đánh giá', 'Phản hồi của quán', 'Hiển thị', 'Ngày đánh giá'];
      const exportRows = data.map((r) => ({
        'Mã ĐG': r.reviewId,
        'Khách hàng': r.customerName,
        'Sản phẩm': r.productName,
        'Số sao': r.rating,
        'Nội dung đánh giá': r.comment,
        'Phản hồi của quán': r.adminReply,
        'Hiển thị': r.isVisible ? 'Đang hiển thị' : 'Đang ẩn',
        'Ngày đánh giá': r.createdAt ? r.createdAt.replace('T', ' ').slice(0, 19) : '',
      }));

      const blob = await firstValueFrom(
        this.http.post(
          this.excelUrl,
          {
            templateKey: 'CRM_Reviews',
            sheetName: 'Đánh giá',
            reportTitle: 'BÁO CÁO ĐÁNH GIÁ KHÁCH HÀNG FIIN COFFEE',
            summaryLabel: 'Tổng số đánh giá:',
            fileName: `BaoCao_DanhGia_${new Date().toISOString().slice(0, 10)}.xlsx`,
            headers,
            rows: exportRows,
          },
          { responseType: 'blob', withCredentials: true },
        ),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BaoCao_DanhGia_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.success(`Đã xuất báo cáo Excel (${data.length} đánh giá).`);
    } catch {
      this.toast.error('Xuất báo cáo Excel thất bại.');
    } finally {
      this.isExporting.set(false);
    }
  }
}
