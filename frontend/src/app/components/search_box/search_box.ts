import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideSearch } from '@lucide/angular';

@Component({
    selector: 'app-search-box',
    imports: [LucideSearch],
    templateUrl: './search_box.html',
    styleUrl: './search_box.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBoxComponent {
    readonly placeholder = input<string>('Xin chào, bạn cần gì hôm nay?');
    readonly ariaLabel = input<string>('Tìm kiếm món ăn, thức uống');

    readonly searched = output<string>();

    onSearch(value: string): void {
        this.searched.emit((value || '').trim());
    }
}