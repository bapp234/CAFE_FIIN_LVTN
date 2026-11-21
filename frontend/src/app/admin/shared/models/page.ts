export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export type SortDirection = 'asc' | 'desc';

export interface PageQuery {
  page: number;
  size: number;
  q?: string;
  sortBy?: string;
  sortOrder?: SortDirection;
  branchId?: string;
  [key: string]: any;
}

/** Cấu hình cột trong bảng admin_data_table */
export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** Custom formatter hoặc hàm trích xuất text */
  render?: (row: T) => string | number;
}
