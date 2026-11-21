import { computed, Injectable, signal } from '@angular/core';
import { AdminUser } from '../../core/admin_session';
import { Branch, MOCK_BRANCHES } from '../models/branch';

@Injectable({ providedIn: 'root' })
export class AdminBranchService {
  readonly branches = signal<readonly Branch[]>(MOCK_BRANCHES);
  readonly selectedBranchId = signal<string>('all');
  readonly isBranchLocked = signal<boolean>(false);

  readonly selectedBranch = computed<Branch>(() => {
    const list = this.branches();
    const id = this.selectedBranchId();
    return list.find((b) => b.id === id) ?? list[0];
  });

  selectBranch(branchId: string): void {
    if (this.isBranchLocked()) return;
    const exists = this.branches().some((b) => b.id === branchId);
    if (exists) {
      this.selectedBranchId.set(branchId);
    }
  }

  /**
   * Đồng bộ phạm vi chi nhánh theo cấp bậc tài khoản đang đăng nhập:
   * - Cấp 4–5 (Admin / HRManager / Accountant): Mở toàn chuỗi ('all') và cho phép đổi chi nhánh.
   * - Cấp 1–3 (StoreManager / ShiftLeader / Barista): Tự động khóa vào chi nhánh công tác của mình.
   */
  syncWithUser(user: AdminUser | null): void {
    if (!user || user.hierarchyLevel >= 4 || !user.branchId) {
      this.isBranchLocked.set(false);
      return;
    }

    const mapped = this.mapBranchIdToKey(user.branchId, user.branchCode);
    if (mapped) {
      this.selectedBranchId.set(mapped);
      this.isBranchLocked.set(true);
    } else {
      this.isBranchLocked.set(false);
    }
  }

  private mapBranchIdToKey(branchId?: number, branchCode?: string): string | null {
    if (branchCode) {
      const found = this.branches().find(
        (b) => b.code.toLowerCase() === branchCode.trim().toLowerCase()
      );
      if (found) return found.id;
    }
    if (branchId === 1) return 'cn-q1';
    if (branchId === 2) return 'cn-q3';
    if (branchId === 3) return 'cn-td';
    if (branchId === 4) return 'cn-bt';
    return null;
  }
}
