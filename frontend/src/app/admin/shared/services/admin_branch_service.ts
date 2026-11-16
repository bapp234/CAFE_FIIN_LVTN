import { computed, Injectable, signal } from '@angular/core';
import { Branch, MOCK_BRANCHES } from '../models/branch';

@Injectable({ providedIn: 'root' })
export class AdminBranchService {
  readonly branches = signal<readonly Branch[]>(MOCK_BRANCHES);
  readonly selectedBranchId = signal<string>('all');

  readonly selectedBranch = computed<Branch>(() => {
    const list = this.branches();
    const id = this.selectedBranchId();
    return list.find((b) => b.id === id) ?? list[0];
  });

  selectBranch(branchId: string): void {
    const exists = this.branches().some((b) => b.id === branchId);
    if (exists) {
      this.selectedBranchId.set(branchId);
    }
  }
}
