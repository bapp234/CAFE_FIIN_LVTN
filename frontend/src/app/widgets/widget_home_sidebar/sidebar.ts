import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Định nghĩa interface trực tiếp ở đây, KHÔNG import ngược từ home.ts
export interface CategoryItem {
    id: string;
    name: string;
    icon: string;
}

@Component({
    selector: 'app-widget-home-sidebar',
    imports: [],
    templateUrl: './sidebar.html', // Đảm bảo đúng tên file trong thư mục widget_home_sidebar
    styleUrl: './sidebar.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeSidebar {
    readonly categories = input.required<CategoryItem[]>();
    readonly isOpen = input<boolean>(true);
}