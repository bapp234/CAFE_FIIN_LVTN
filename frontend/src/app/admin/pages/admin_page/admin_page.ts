import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { LucideConstruction } from '@lucide/angular';
import { AdminIconComponent } from '../../components/admin_icon/admin_icon';
import { getAdminModule } from '../../core/admin_modules';

/**
 * Trang tạm cho mọi mục menu chưa làm. Đọc module và mục menu từ route.data
 * (do buildModuleRoutes gắn vào) để hiện đúng tiêu đề.
 */
@Component({
  selector: 'app-admin-page',
  imports: [AdminIconComponent, LucideConstruction],
  templateUrl: './admin_page.html',
  styleUrl: './admin_page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  protected readonly module = computed(() => getAdminModule(this.data()['module']));

  protected readonly item = computed(
    () => this.module()?.menu.find((m) => m.path === this.data()['menuPath']) ?? null,
  );
}
