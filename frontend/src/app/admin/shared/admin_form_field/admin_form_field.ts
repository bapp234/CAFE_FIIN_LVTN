import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-admin-form-field',
  templateUrl: './admin_form_field.html',
  styleUrl: './admin_form_field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminFormField {
  readonly label = input<string>('');
  readonly htmlFor = input<string>('');
  readonly required = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly hint = input<string>('');
}
