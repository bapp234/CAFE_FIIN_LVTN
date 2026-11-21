/**
 * Trả về chuỗi ngày theo múi giờ cục bộ dạng YYYY-MM-DD.
 */
export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ngày hiện tại dạng YYYY-MM-DD.
 */
export function getTodayIsoDate(now: Date = new Date()): string {
  return formatLocalIsoDate(now);
}

/**
 * Kỳ tháng/năm hiện tại dạng YYYY-MM.
 */
export function getCurrentYearMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Khoảng ngày đầu tháng và cuối tháng hiện tại dạng YYYY-MM-DD.
 */
export function getCurrentMonthRange(now: Date = new Date()): { fromDate: string; toDate: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    fromDate: formatLocalIsoDate(start),
    toDate: formatLocalIsoDate(end),
  };
}

/**
 * Thứ Hai của tuần hiện tại dạng YYYY-MM-DD.
 */
export function getCurrentWeekMondayIso(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay(); // 0 = CN, 1 = T2, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalIsoDate(d);
}
