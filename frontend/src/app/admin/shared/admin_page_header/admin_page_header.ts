import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucideStore } from '@lucide/angular';
import { AdminBranchService } from '../services/admin_branch_service';

@Component({
  selector: 'app-admin-page-header',
  templateUrl: './admin_page_header.html',
  styleUrl: './admin_page_header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, RouterLink, LucideChevronRight, LucideStore],
})
export class AdminPageHeader {
  readonly branchService = inject(AdminBranchService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly module = input<string>('');
  readonly moduleLabel = input<string>('');
  readonly modulePath = input<string>('');
  readonly showBranchSelector = input<boolean>(true);

  onBranchChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.branchService.selectBranch(val);
  }
}
