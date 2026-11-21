import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucidePrinter, LucideX } from '@lucide/angular';
import { BrandLogoComponent } from '../../../../../components/brand_logo/brand_logo';
import { PayrollSlip } from '../../models/payroll';

@Component({
  selector: 'app-hrm-payroll-slip-modal',
  templateUrl: './hrm_payroll_slip_modal.html',
  styleUrl: './hrm_payroll_slip_modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, LucideX, LucidePrinter, BrandLogoComponent],
})
export class HrmPayrollSlipModal {
  readonly isOpen = input.required<boolean>();
  readonly slip = input<PayrollSlip | null>(null);

  readonly close = output<void>();

  printSlip(): void {
    window.print();
  }
}
