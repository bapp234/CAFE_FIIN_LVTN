import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

export interface HeroSlideItem {
    title: string;
    subtitle: string;
    desc: string;
    image: string;
}

@Component({
    selector: 'app-widget-home-hero',
    imports: [LucideChevronLeft, LucideChevronRight],
    templateUrl: './hero.html',
    styleUrl: './hero.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeHero {
    readonly slides = input.required<HeroSlideItem[]>();
    readonly currentSlide = input.required<number>();

    readonly orderClick = output<void>();
    readonly prevClick = output<void>();
    readonly nextClick = output<void>();
}