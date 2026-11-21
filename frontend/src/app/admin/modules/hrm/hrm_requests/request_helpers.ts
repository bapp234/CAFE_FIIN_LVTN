import { AdminUser } from '../../../core/admin_session';
import { ComboOption } from '../../../components/admin_combo_box/admin_combo_box';
import { Employee } from '../models/employee';
import {
  EmployeePermissionSettingItem,
  getPositionLevel,
} from '../services/hrm_employee_api';

export interface RequestApproverItem {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchName: string;
  approvalLevel: number;
  approvalLevelName: string;
  roleNames?: string;
  isSelfApprover?: boolean;
}

export function getCurrentUsername(user: AdminUser | null): string {
  if (!user) return 'admin';
  if (user.username) return user.username;
  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0];
  }
  return user.name || 'admin';
}

export function getCurrentUserLevel(user: AdminUser | null): number {
  if (!user) return 1;
  if (user.hierarchyLevel && user.hierarchyLevel > 0) {
    return user.hierarchyLevel;
  }
  return getPositionLevel(user.role);
}

export function getEmployeeNumericId(emp: Employee): number {
  return Number(emp.employeeId ?? emp.id ?? 0);
}

export function getEmployeeLevel(emp: Employee | null): number {
  if (!emp) return 1;
  return emp.hierarchyLevel && emp.hierarchyLevel > 0
    ? emp.hierarchyLevel
    : getPositionLevel(emp.position);
}

export function formatHierarchyLevelLabel(level: number, roleName?: string): string {
  const base =
    level >= 5
      ? 'Cấp 5 — Ban Giám đốc / Admin'
      : level === 4
        ? 'Cấp 4 — Quản trị Nhân sự'
        : level === 3
          ? 'Cấp 3 — Quản lý Cửa hàng'
          : level === 2
            ? 'Cấp 2 — Trưởng ca'
            : 'Cấp 1 — Nhân viên';

  return roleName ? `${base} (${roleName})` : base;
}

/**
 * Lọc danh sách nhân sự được phép chọn theo cấp bậc tài khoản đang đăng nhập:
 * - Nhân viên cấp thấp (Cấp 1): chỉ có duy nhất chính họ trong combobox.
 * - Cấp cao hơn (Cấp 2..5): thấy nhân sự trong phạm vi phân cấp được trả về từ server.
 */
export function resolveScopedEmployees(
  employees: Employee[],
  currentUser: AdminUser | null
): { items: Employee[]; isSelfOnly: boolean } {
  if (!employees.length) {
    return { items: [], isSelfOnly: getCurrentUserLevel(currentUser) <= 1 };
  }

  const myLevel = getCurrentUserLevel(currentUser);
  const userEmail = currentUser?.email?.trim().toLowerCase() ?? '';
  const userName = currentUser?.name?.trim().toLowerCase() ?? '';
  const userHandle = getCurrentUsername(currentUser).trim().toLowerCase();

  if (myLevel <= 1) {
    const matchedSelf = employees.find((e) => {
      const eEmail = (e.email ?? '').trim().toLowerCase();
      const eName = (e.fullName ?? '').trim().toLowerCase();
      const eUsername = (e.username ?? '').trim().toLowerCase();
      const eCode = (e.code ?? e.employeeCode ?? '').trim().toLowerCase();
      return (
        (userEmail && eEmail === userEmail) ||
        (userName && eName === userName) ||
        (userHandle && (eUsername === userHandle || eCode === userHandle))
      );
    });

    if (matchedSelf) {
      return { items: [matchedSelf], isSelfOnly: true };
    }

    // Nếu API hierarchy đã lọc sẵn còn 1 nhân sự hoặc chưa khớp tên demo, giữ đúng 1 hồ sơ đầu tiên
    return { items: [employees[0]], isSelfOnly: true };
  }

  // Cấp 2..5: đảm bảo không vượt quá cấp của chính người đăng nhập
  const scoped = employees.filter((e) => getEmployeeLevel(e) <= myLevel);
  const finalItems = scoped.length > 0 ? scoped : employees;
  return { items: finalItems, isSelfOnly: finalItems.length <= 1 };
}

/**
 * Xác định danh sách người phê duyệt cho nhân sự lập đơn:
 * - Mỗi nhân sự chỉ có tối đa 2 người duyệt cấp cao hơn (ưu tiên cùng chi nhánh và 2 cấp duyệt kế tiếp nhau).
 * - Nếu bản thân người tạo đơn cũng có thẩm quyền duyệt (approvalLevel > 0) thì được phép tự duyệt đơn của mình.
 */
export function resolveApproversForEmployee(
  employee: Employee | null,
  matrix: EmployeePermissionSettingItem[]
): RequestApproverItem[] {
  if (!employee || !matrix.length) return [];

  const empId = getEmployeeNumericId(employee);
  const empBranchId = employee.numericBranchId ?? null;
  const empBranchName = (employee.branchName ?? '').trim().toLowerCase();
  const empHierarchyLevel = getEmployeeLevel(employee);

  const toApproverItem = (
    c: EmployeePermissionSettingItem,
    isSelfApprover = false
  ): RequestApproverItem => ({
    employeeId: c.employeeId,
    employeeCode: c.employeeCode,
    fullName: c.fullName,
    position: c.position,
    branchName: c.branchName || 'Toàn chuỗi',
    approvalLevel: c.approvalLevel,
    approvalLevelName:
      c.approvalLevelName ||
      (c.approvalLevel === 1
        ? 'Duyệt Cấp 1'
        : c.approvalLevel === 2
          ? 'Duyệt Cấp 2'
          : `Duyệt Cấp ${c.approvalLevel}`),
    roleNames: c.roleNames,
    isSelfApprover,
  });

  // 1. Kiểm tra người tạo đơn có quyền tự duyệt không
  const selfItem = matrix.find(
    (item) =>
      item.employeeId === empId &&
      item.employeeStatus !== 'resigned' &&
      item.isUserActive !== false &&
      item.approvalLevel > 0
  );
  const selfApprovalLevel = selfItem?.approvalLevel ?? 0;

  // 2. Lọc ứng viên cấp cao hơn (tối đa 2 người)
  interface RankedCandidate {
    item: EmployeePermissionSettingItem;
    isSameBranch: boolean;
    effectiveLevel: number;
  }

  const rankedHigher: RankedCandidate[] = [];
  const seenIds = new Set<number>([empId]);

  for (const item of matrix) {
    if (seenIds.has(item.employeeId)) continue;
    if (item.employeeStatus === 'resigned' || item.isUserActive === false) continue;
    if (!item.approvalLevel || item.approvalLevel <= 0) continue;

    const rolesLower = (item.roleNames ?? '').toLowerCase();
    const posLower = (item.position ?? '').toLowerCase();
    const isChainWide =
      item.approvalLevel >= 3 ||
      !item.branchId ||
      item.branchId <= 0 ||
      rolesLower.includes('admin') ||
      rolesLower.includes('hr') ||
      posLower.includes('giám đốc') ||
      posLower.includes('nhân sự');

    const itemBranchName = (item.branchName ?? '').trim().toLowerCase();
    const isSameBranch =
      (empBranchId !== null && item.branchId === empBranchId) ||
      (empBranchName !== '' && itemBranchName === empBranchName);

    if (!isChainWide && !isSameBranch) continue;

    const effectiveLevel = Math.max(item.approvalLevel, getPositionLevel(item.position));
    const isStrictlyHigher =
      selfApprovalLevel > 0
        ? item.approvalLevel > selfApprovalLevel || effectiveLevel > empHierarchyLevel
        : effectiveLevel > empHierarchyLevel || item.approvalLevel >= 1;

    if (!isStrictlyHigher) continue;

    seenIds.add(item.employeeId);
    rankedHigher.push({ item, isSameBranch, effectiveLevel });
  }

  // Sắp xếp ứng viên cấp cao hơn: cấp duyệt tăng dần -> ưu tiên cùng chi nhánh -> mã NV
  rankedHigher.sort((a, b) => {
    if (a.item.approvalLevel !== b.item.approvalLevel) {
      return a.item.approvalLevel - b.item.approvalLevel;
    }
    if (a.isSameBranch !== b.isSameBranch) {
      return a.isSameBranch ? -1 : 1;
    }
    return a.item.employeeCode.localeCompare(b.item.employeeCode);
  });

  // Chọn tối đa 2 người cấp cao hơn: ưu tiên mỗi cấp duyệt 1 người đại diện trước
  const selectedHigher: EmployeePermissionSettingItem[] = [];
  const pickedLevels = new Set<number>();

  for (const cand of rankedHigher) {
    if (selectedHigher.length >= 2) break;
    if (!pickedLevels.has(cand.item.approvalLevel)) {
      pickedLevels.add(cand.item.approvalLevel);
      selectedHigher.push(cand.item);
    }
  }

  // Nếu chỉ có 1 mức cấp duyệt cao hơn nhưng có >= 2 người, bổ sung đủ tối đa 2 người
  if (selectedHigher.length < 2) {
    const pickedIds = new Set(selectedHigher.map((x) => x.employeeId));
    for (const cand of rankedHigher) {
      if (selectedHigher.length >= 2) break;
      if (!pickedIds.has(cand.item.employeeId)) {
        pickedIds.add(cand.item.employeeId);
        selectedHigher.push(cand.item);
      }
    }
  }

  const result: RequestApproverItem[] = [];
  if (selfItem) {
    result.push(toApproverItem(selfItem, true));
  }
  for (const higher of selectedHigher) {
    result.push(toApproverItem(higher, false));
  }

  return result;
}

export function buildEmployeeComboOptions(
  employees: Employee[],
  includeAllOption: boolean
): ComboOption[] {
  const opts: ComboOption[] = employees.map((e) => ({
    value: String(getEmployeeNumericId(e)),
    label: `${e.code || e.employeeCode || 'NV'} — ${e.fullName}`,
  }));

  if (includeAllOption) {
    return [{ value: 'all', label: 'Tất cả nhân sự' }, ...opts];
  }
  return opts;
}

/**
 * Ưu tiên hiển thị đơn đang chờ duyệt (pending) lên đầu bảng,
 * sau đó tới đã duyệt (approved) và từ chối (rejected), mới nhất lên trên.
 */
export function compareRequestPriority(
  statusA: string,
  statusB: string,
  dateA: string,
  dateB: string
): number {
  const rank = (st: string): number => {
    const s = (st || '').toLowerCase();
    if (s === 'cancel_pending') return 0;
    if (s === 'pending') return 1;
    if (s === 'approved') return 2;
    if (s === 'cancelled') return 3;
    if (s === 'rejected') return 4;
    return 5;
  };

  const diff = rank(statusA) - rank(statusB);
  if (diff !== 0) return diff;
  return (dateB || '').localeCompare(dateA || '');
}

/**
 * Kiểm tra xem đơn đã duyệt có thuộc về cá nhân đang đăng nhập (hoặc trong danh sách nhân sự được phép thao tác) để hiển thị nút "Hủy đơn" hay không.
 */
export function canUserRequestCancelOnApprovedRow(
  rowEmployeeId: number,
  rowEmployeeCode: string,
  currentUser: AdminUser | null,
  scopedEmployees: Employee[]
): boolean {
  if (!currentUser) return false;
  const userHandle = getCurrentUsername(currentUser).trim().toLowerCase();
  const userName = (currentUser.name ?? '').trim().toLowerCase();
  const codeLower = (rowEmployeeCode ?? '').trim().toLowerCase();

  if (codeLower && userHandle && codeLower === userHandle) return true;

  const matchedEmp = scopedEmployees.find((e) => getEmployeeNumericId(e) === Number(rowEmployeeId));
  if (matchedEmp) {
    const eUsername = (matchedEmp.username ?? '').trim().toLowerCase();
    const eName = (matchedEmp.fullName ?? '').trim().toLowerCase();
    const eCode = (matchedEmp.code ?? matchedEmp.employeeCode ?? '').trim().toLowerCase();
    if (
      (userHandle && (eUsername === userHandle || eCode === userHandle)) ||
      (userName && eName === userName)
    ) {
      return true;
    }
  }

  // Cho phép nhân sự/quản lý thao tác đại diện trên các hồ sơ trong phạm vi quản lý của họ (hoặc khi demo ở chế độ self-only)
  if (scopedEmployees.length === 1 && getEmployeeNumericId(scopedEmployees[0]) === Number(rowEmployeeId)) {
    return true;
  }

  return scopedEmployees.some((e) => getEmployeeNumericId(e) === Number(rowEmployeeId));
}
