import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminSession } from '../../../core/admin_session';

@Component({
  selector: 'app-hrm-contracts',
  templateUrl: './hrm_contracts.html',
  styleUrl: './hrm_contracts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class HrmContracts {
  private readonly session = inject(AdminSession);

  readonly canManageSettings = computed(() => this.session.hierarchyLevel() >= 4);
}
