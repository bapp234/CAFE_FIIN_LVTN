import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ADMIN_MODULES, AdminModule } from './admin_modules';

/** Cho biết đang ở module nào, dựa vào URL dạng /admin/<module>/... */
@Injectable({ providedIn: 'root' })
export class AdminNav {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly activeModule = computed<AdminModule | null>(() => {
    const segments = this.url().split(/[?#]/)[0].split('/').filter(Boolean);
    if (segments[0] !== 'admin') return null;
    return ADMIN_MODULES.find((m) => m.key === segments[1]) ?? null;
  });
}
