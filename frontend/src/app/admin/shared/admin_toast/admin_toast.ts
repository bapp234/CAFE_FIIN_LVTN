import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideCheckCircle,
  LucideInfo,
  LucideX,
} from '@lucide/angular';
import { AdminToastService } from '../services/admin_toast_service';

@Component({
  selector: 'app-admin-toast',
  templateUrl: './admin_toast.html',
  styleUrl: './admin_toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo, LucideX],
})
export class AdminToast {
  readonly toastService = inject(AdminToastService);
}
