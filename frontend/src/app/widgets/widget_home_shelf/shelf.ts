import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucidePlus } from '@lucide/angular';
import { Product } from '../../pages/page_home/home';

@Component({
    selector: 'app-widget-home-shelf',
    imports: [
        CommonModule,
        RouterLink,
        NgTemplateOutlet,
        LucidePlus,
        LucideChevronRight,
    ],
    templateUrl: './shelf.html',
    styleUrl: './shelf.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeShelf {
    readonly title = input.required<string>();
    readonly icon = input<string | null>(null);
    readonly sectionId = input<string>('');
    readonly products = input.required<Product[]>();

    readonly bannerLead = input<{
        badge: string;
        sub: string;
        title: string;
        desc: string;
        image: string;
    } | null>(null);

    readonly selectProduct = output<Product>();

    formatPrice(price: number): string {
        return price.toLocaleString('vi-VN') + 'đ';
    }
}