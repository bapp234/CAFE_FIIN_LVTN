import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCheck } from '@lucide/angular';
import { Voucher } from '../../pages/page_home/home';

@Component({
    selector: 'app-widget-home-vouchers',
    imports: [LucideCheck],
    templateUrl: './vouchers.html',
    styleUrl: './vouchers.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeVouchers {
    readonly vouchers = input.required<Voucher[]>();
    readonly copyVoucher = output<string>();
}