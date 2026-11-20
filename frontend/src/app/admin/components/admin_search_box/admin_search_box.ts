import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
    selector: 'app-admin-search-box',
    imports: [],
    templateUrl: './admin_search_box.html',
    styleUrl: './admin_search_box.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSearchBoxComponent {
    readonly placeholder = input<string>('Xin chào, bạn cần gì hôm nay?');
    readonly ariaLabel = input<string>('Tìm kiếm món ăn, thức uống');

    readonly searched = output<string>();

    private debounceTimer?: ReturnType<typeof setTimeout>;
    onInput(value: string): void {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.searched.emit((value || '').trim());
        }, 300);
    }
    onSearch(value: string): void {
        clearTimeout(this.debounceTimer);
        this.searched.emit((value || '').trim());
    }
}