import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideBean,
  LucideCakeSlice,
  LucideCoffee,
  LucideCupSoda,
  LucideGlassWater,
  LucideIceCreamCone,
  LucideLeaf,
  LucidePackage,
  LucideSprout,
  LucideUtensils,
  LucideWheat,
} from '@lucide/angular';

/** Các khóa icon hiện có. Thêm icon mới: import ở trên, thêm khóa vào đây và 1 @case trong html. */
export type CategoryIconKey =
  | 'coffee'
  | 'leaf'
  | 'ice-cream'
  | 'bean'
  | 'wheat'
  | 'cake'
  | 'cup-soda'
  | 'sprout'
  | 'glass-water'
  | 'package';

/**
 * Hiển thị icon Lucide theo khóa, ví dụ <app-category-icon name="coffee" />.
 * Khóa lạ hoặc rỗng sẽ hiện icon mặc định (dao dĩa) thay vì để trống.
 */
@Component({
  selector: 'app-category-icon',
  imports: [
    LucideCoffee,
    LucideLeaf,
    LucideIceCreamCone,
    LucideBean,
    LucideWheat,
    LucideCakeSlice,
    LucideCupSoda,
    LucideSprout,
    LucideGlassWater,
    LucidePackage,
    LucideUtensils,
  ],
  templateUrl: './category_icon.html',
  styleUrl: './category_icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryIconComponent {
  /** Chấp nhận string để khớp dữ liệu từ nơi khác; khóa không biết sẽ rơi vào icon mặc định */
  readonly name = input<CategoryIconKey | string>('');
}
