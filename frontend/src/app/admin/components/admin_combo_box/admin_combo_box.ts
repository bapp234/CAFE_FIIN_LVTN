import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Injector,
    afterNextRender,
    computed,
    inject,
    input,
    model,
    signal,
    viewChild,
} from '@angular/core';
import { LucideCheck, LucideChevronDown } from '@lucide/angular';

export interface ComboOption {
    value: string;
    label: string;
    disabled?: boolean;
}function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd');
}
@Component({
    selector: 'app-admin-combo-box',
    templateUrl: './admin_combo_box.html',
    styleUrl: './admin_combo_box.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [LucideChevronDown, LucideCheck],
    host: {
        '(document:click)': 'onDocumentClick($event)',
    },
})
export class AdminComboBoxComponent {
    private static nextId = 0;

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);

    readonly options = input.required<ComboOption[]>();
    readonly value = model<string>('');
    readonly placeholder = input('Chọn...');
    readonly ariaLabel = input('');
    readonly searchable = input(true);
    readonly searchPlaceholder = input('Tìm nhanh...');
    readonly emptyText = input('Không có kết quả');
    readonly disabled = input(false);
    readonly placement = input<'bottom' | 'top'>('bottom');

    readonly isOpen = signal(false);
    readonly query = signal('');
    readonly activeIndex = signal(0);

    readonly uid = `admin-combo-${++AdminComboBoxComponent.nextId}`;
    readonly listId = `${this.uid}-list`;

    private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
    private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

    readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);

    readonly filtered = computed(() => {
        const q = normalize(this.query().trim());
        if (!q) return this.options();
        return this.options().filter((o) => normalize(o.label).includes(q));
    });

    readonly activeDescendant = computed(() =>
        this.isOpen() && this.filtered()[this.activeIndex()] ? this.optionId(this.activeIndex()) : null
    );

    optionId(index: number): string {
        return `${this.uid}-opt-${index}`;
    }

    toggle(): void {
        this.isOpen() ? this.close() : this.open();
    }

    open(): void {
        if (this.disabled() || this.isOpen()) return;
        this.query.set('');
        const selectedIdx = this.filtered().findIndex((o) => o.value === this.value());
        this.activeIndex.set(selectedIdx >= 0 ? selectedIdx : this.firstEnabledIndex());
        this.isOpen.set(true);
        afterNextRender(
            () => {
                this.searchInput()?.nativeElement.focus();
                this.scrollToActive();
            },
            { injector: this.injector }
        );
    }

    close(returnFocus = false): void {
        if (!this.isOpen()) return;
        this.isOpen.set(false);
        if (returnFocus) this.trigger()?.nativeElement.focus();
    }

    select(option: ComboOption): void {
        if (option.disabled) return;
        this.value.set(option.value);
        this.close(true);
    }

    onQueryInput(event: Event): void {
        this.query.set((event.target as HTMLInputElement).value);
        this.activeIndex.set(this.firstEnabledIndex());
    }

    onKeydown(event: KeyboardEvent): void {
        if (this.disabled()) return;
        const inSearch = (event.target as HTMLElement).classList.contains('combo-search');

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.isOpen() ? this.move(1) : this.open();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.isOpen() ? this.move(-1) : this.open();
                break;
            case 'Home':
                if (this.isOpen() && !inSearch) {
                    event.preventDefault();
                    this.activeIndex.set(this.firstEnabledIndex());
                    this.scrollToActive();
                }
                break;
            case 'End':
                if (this.isOpen() && !inSearch) {
                    event.preventDefault();
                    this.activeIndex.set(this.lastEnabledIndex());
                    this.scrollToActive();
                }
                break;
            case 'Enter':
                event.preventDefault();
                if (!this.isOpen()) {
                    this.open();
                } else {
                    const opt = this.filtered()[this.activeIndex()];
                    if (opt) this.select(opt);
                }
                break;
            case ' ':
                if (!inSearch) {
                    event.preventDefault();
                    if (!this.isOpen()) {
                        this.open();
                    } else {
                        const opt = this.filtered()[this.activeIndex()];
                        if (opt) this.select(opt);
                    }
                }
                break;
            case 'Escape':
                if (this.isOpen()) {
                    event.preventDefault();
                    this.close(true);
                }
                break;
            case 'Tab':
                this.close();
                break;
        }
    }

    onDocumentClick(event: MouseEvent): void {
        if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
            this.close();
        }
    }

    private move(step: 1 | -1): void {
        const list = this.filtered();
        if (!list.length) return;
        let idx = this.activeIndex();
        for (let i = 0; i < list.length; i++) {
            idx = (idx + step + list.length) % list.length;
            if (!list[idx].disabled) break;
        }
        this.activeIndex.set(idx);
        this.scrollToActive();
    }

    private firstEnabledIndex(): number {
        const idx = this.filtered().findIndex((o) => !o.disabled);
        return idx >= 0 ? idx : 0;
    }

    private lastEnabledIndex(): number {
        const list = this.filtered();
        for (let i = list.length - 1; i >= 0; i--) {
            if (!list[i].disabled) return i;
        }
        return 0;
    }

    private scrollToActive(): void {
        afterNextRender(
            () => {
                this.host.nativeElement
                    .querySelector(`#${this.optionId(this.activeIndex())}`)
                    ?.scrollIntoView({ block: 'nearest' });
            },
            { injector: this.injector }
        );
    }
}