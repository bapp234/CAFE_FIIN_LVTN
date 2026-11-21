import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideBuilding2,
  LucideCheckCircle2,
  LucideShieldCheck,
  LucideUserCheck,
} from '@lucide/angular';
import { AdminDrawer } from '../../../../../shared/admin_drawer/admin_drawer';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import { Employee } from '../../../models/employee';
import {
  buildEmployeeComboOptions,
  formatHierarchyLevelLabel,
  getEmployeeLevel,
  getEmployeeNumericId,
  RequestApproverItem,
} from '../../request_helpers';

@Component({
  selector: 'app-request-create-drawer',
  templateUrl: './request_create_drawer.html',
  styleUrl: './request_create_drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideBuilding2,
    LucideCheckCircle2,
    LucideShieldCheck,
    LucideUserCheck,
    AdminDrawer,
    AdminComboBoxComponent,
  ],
})
export class RequestCreateDrawerComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>('Chọn nhân sự để tự động điền thông tin, nhập lý do và gửi chờ duyệt.');
  readonly submitLabel = input<string>('Gửi đơn & Chờ duyệt');
  readonly isSubmitting = input<boolean>(false);
  readonly submitDisabled = input<boolean>(false);

  readonly employees = input.required<Employee[]>();
  readonly selectedEmployeeId = input.required<number>();
  readonly isSelfOnly = input<boolean>(false);

  readonly approvers = input<RequestApproverItem[]>([]);
  readonly isLoadingApprovers = input<boolean>(false);

  readonly employeeSelected = output<number>();
  readonly submit = output<void>();
  readonly close = output<void>();

  readonly employeeOptions = computed<ComboOption[]>(() =>
    buildEmployeeComboOptions(this.employees(), false)
  );

  readonly selectedEmployeeIdStr = computed(() =>
    this.selectedEmployeeId() ? String(this.selectedEmployeeId()) : ''
  );

  readonly selectedEmployee = computed<Employee | null>(() => {
    const id = this.selectedEmployeeId();
    return this.employees().find((e) => getEmployeeNumericId(e) === id) ?? null;
  });

  readonly selectedEmployeeLevelLabel = computed(() => {
    const emp = this.selectedEmployee();
    if (!emp) return '—';
    return formatHierarchyLevelLabel(getEmployeeLevel(emp), emp.roleName);
  });

  onEmployeeChange(value: string): void {
    const num = Number(value);
    if (!isNaN(num) && num > 0) {
      this.employeeSelected.emit(num);
    }
  }
}
