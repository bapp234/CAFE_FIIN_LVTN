import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideCoins,
  LucideKeyRound,
  LucideLogOut,
  LucideMapPin,
  LucidePackage,
  LucidePlus,
  LucideShoppingBag,
  LucideTicket,
  LucideTrash2,
  LucideUser,
} from '@lucide/angular';
import { ButtonOrderComponent } from '../../components/button_order/button_order';
import { ComboBoxDfComponent } from '../../components/combo_box_df/combo_box_df';
import { ComboBoxMultiComponent, ComboBoxOption } from '../../components/combo_box_multi/combo_box_multi';
import { InputFloatingComponent } from '../../components/input_floating/input_floating';
import {
  CustomerAuthApiError,
  CustomerAuthService,
  CustomerProfile,
} from '../../services/customer_auth_service';
import {
  CustomerOrderDto,
  CustomerOrderService,
} from '../../services/customer_order_service';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';

type ProfileTab = 'info' | 'password' | 'addresses' | 'vouchers' | 'cart' | 'orders';

interface AddressDraft {
  id: number;
  label: string;
  receiverName: string;
  receiverPhone: string;
  fullAddress: string;
  isDefault: boolean;
}

interface ProvinceOption {
  provinceId: string;
  name: string;
}

interface WardOption {
  wardId: string;
  provinceId: string;
  name: string;
}

const TIER_LABELS: Record<string, string> = {
  Standard: 'Đồng Điệu (Standard)',
  Silver: 'Hạng Bạc (Silver)',
  Gold: 'Hạng Vàng (Gold)',
  VIP: 'Thượng Khách (VIP)',
};

@Component({
  selector: 'app-page-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    WidgetHeader,
    WidgetLandingFooter,
    InputFloatingComponent,
    ButtonOrderComponent,
    ComboBoxMultiComponent,
    ComboBoxDfComponent,
    LucideUser,
    LucideMapPin,
    LucideLogOut,
    LucideShoppingBag,
    LucideKeyRound,
    LucideTicket,
    LucideCoins,
    LucidePackage,
    LucidePlus,
    LucideTrash2,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageProfile implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(CustomerAuthService);
  private readonly orderService = inject(CustomerOrderService);

  readonly activeTab = signal<ProfileTab>('info');
  readonly profile = signal<CustomerProfile | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isFallbackPreview = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  // Giỏ hàng, Voucher & Đơn hàng từ DB
  readonly cartCount = this.orderService.cartCount;
  readonly cartItems = this.orderService.cartItems;
  readonly cartSubtotal = this.orderService.cartSubtotal;
  readonly wallet = this.orderService.wallet;
  readonly myOrders = this.orderService.myOrders;
  readonly selectedOrderType = signal<'OnlineDelivery' | 'OnlinePickUp'>('OnlineDelivery');
  readonly selectedCustomerVoucherId = signal<number | null>(null);
  readonly placingOrder = signal(false);
  readonly redeemingVoucherId = signal<number | null>(null);
  readonly cancellingOrderId = signal<number | null>(null);

  readonly availableCustomerVouchers = computed(() =>
    this.wallet().myVouchers.filter((v) => v.status === 'Available')
  );

  readonly estimatedDiscount = computed(() => {
    const cvId = this.selectedCustomerVoucherId();
    const sub = this.cartSubtotal();
    if (!cvId || sub <= 0) return 0;
    const v = this.availableCustomerVouchers().find((item) => item.customerVoucherId === cvId);
    if (!v || sub < v.minOrderAmount) return 0;
    if (v.discountType === 'Percentage') {
      const raw = Math.round((sub * v.discountValue) / 100);
      return v.maxDiscountAmount ? Math.min(raw, v.maxDiscountAmount) : raw;
    }
    return Math.min(v.discountValue, sub);
  });

  readonly estimatedShipping = computed(() =>
    this.selectedOrderType() === 'OnlineDelivery' && this.cartSubtotal() > 0 ? 15000 : 0
  );

  readonly estimatedTotal = computed(() =>
    Math.max(0, this.cartSubtotal() - this.estimatedDiscount() + this.estimatedShipping())
  );

  readonly addresses = signal<AddressDraft[]>([]);
  readonly isAddingAddress = signal(false);
  readonly isChangingPassword = signal(false);
  readonly provinces = signal<ProvinceOption[]>([]);
  readonly wards = signal<WardOption[]>([]);
  readonly selectedProvinceId = signal('');
  readonly selectedWardId = signal('');
  readonly openDropdown = signal<'province' | 'ward' | null>(null);

  readonly genderOptions: ComboBoxOption[] = [
    { value: 'Nam', label: 'Nam' },
    { value: 'Nữ', label: 'Nữ' },
    { value: 'Khác', label: 'Khác' },
  ];

  readonly provinceOptions = computed<ComboBoxOption[]>(() =>
    this.provinces().map((p) => ({ value: p.provinceId, label: p.name })),
  );

  readonly wardOptions = computed<ComboBoxOption[]>(() =>
    this.wards().map((w) => ({ value: w.wardId, label: w.name })),
  );

  readonly selectedProvinceName = computed(() => {
    const id = this.selectedProvinceId();
    return this.provinces().find((p) => p.provinceId === id)?.name || '-- Chọn Tỉnh / Thành phố --';
  });

  readonly selectedWardName = computed(() => {
    const id = this.selectedWardId();
    return this.wards().find((w) => w.wardId === id)?.name || '-- Chọn Phường / Xã --';
  });

  readonly tierLabel = computed(() => {
    const tier = this.profile()?.membershipTier || 'Standard';
    return TIER_LABELS[tier] || tier;
  });

  readonly profileForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phoneNumber: [''],
    gender: [''],
    defaultAddress: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  readonly addressForm = this.fb.nonNullable.group({
    label: ['Nhà riêng', [Validators.required]],
    receiverName: ['', [Validators.required]],
    receiverPhone: ['', [Validators.required]],
    fullAddress: ['', [Validators.required, Validators.minLength(5)]],
    isDefault: [true],
  });

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParamMap.get('tab') as ProfileTab | null;
    if (tabParam && ['info', 'password', 'addresses', 'vouchers', 'cart', 'orders'].includes(tabParam)) {
      this.activeTab.set(tabParam);
    }

    void this.loadProfile();
    void this.loadProvinces();

    const timer = setInterval(() => {
      if (this.activeTab() === 'orders' && !this.isFallbackPreview()) {
        void this.orderService.loadMyOrders();
        void this.refreshProfileSilent();
      }
    }, 10000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    const pwToken = this.route.snapshot.queryParamMap.get('pwToken');
    if (pwToken) {
      void this.confirmPasswordToken(pwToken);
    }
  }

  private async refreshProfileSilent(): Promise<void> {
    try {
      const p = await this.authService.getProfile();
      this.profile.set(p);
      this.isFallbackPreview.set(false);
    } catch {
      // ignore silent refresh errors
    }
  }

  private async loadCustomerCommerceData(): Promise<void> {
    try {
      await Promise.all([
        this.orderService.loadCart(),
        this.orderService.loadVoucherWallet(),
        this.orderService.loadMyOrders(),
      ]);
    } catch {
      this.errorMsg.set('Phiên khách hàng chưa được xác thực hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  async confirmPasswordToken(token: string): Promise<void> {
    this.activeTab.set('password');
    try {
      await firstValueFrom(
        this.http.get('http://localhost:5107/api/v1/auth/change-password/confirm', {
          params: { token },
          withCredentials: true,
        }),
      );
      this.successMsg.set('Đổi mật khẩu thành công!');
    } catch {
      this.errorMsg.set('Liên kết xác nhận đổi mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
  }

  async loadProvinces(): Promise<void> {
    try {
      const list = await firstValueFrom(
        this.http.get<ProvinceOption[]>('http://localhost:5107/api/locations/provinces'),
      );
      this.provinces.set(list ?? []);
    } catch {
      this.provinces.set([]);
    }
  }

  toggleDropdown(type: 'province' | 'ward'): void {
    if (type === 'ward' && !this.selectedProvinceId()) {
      return;
    }
    this.openDropdown.update((cur) => (cur === type ? null : type));
  }

  async onProvinceChange(provinceId: string | undefined): Promise<void> {
    const nextProvinceId = provinceId ?? '';
    this.selectedProvinceId.set(nextProvinceId);
    this.selectedWardId.set('');
    this.wards.set([]);
    this.openDropdown.set(null);
    if (!nextProvinceId) {
      return;
    }
    try {
      const list = await firstValueFrom(
        this.http.get<WardOption[]>('http://localhost:5107/api/locations/wards', {
          params: { provinceId: nextProvinceId },
        }),
      );
      this.wards.set(list ?? []);
    } catch {
      this.wards.set([]);
    }
  }

  onWardChange(wardId: string | undefined): void {
    this.selectedWardId.set(wardId ?? '');
    this.openDropdown.set(null);
  }

  onGenderChange(gender: string | undefined): void {
    this.profileForm.controls.gender.setValue(gender ?? '');
  }

  onOrderTypeChange(value: string | undefined): void {
    this.selectedOrderType.set(value === 'OnlinePickUp' ? 'OnlinePickUp' : 'OnlineDelivery');
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    this.errorMsg.set('');
    this.successMsg.set('');
    if (!this.isFallbackPreview() && (tab === 'cart' || tab === 'orders' || tab === 'vouchers')) {
      void this.loadCustomerCommerceData();
    }
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set('');
    this.isFallbackPreview.set(false);
    try {
      const data = await this.authService.getProfile();
      this.applyProfile(data);
      await this.loadCustomerCommerceData();
    } catch {
      const sessionUser = this.authService.user();
      if (sessionUser) {
        this.isFallbackPreview.set(true);
        this.applyProfile({
          customerId: sessionUser.customerId ?? 0,
          userId: sessionUser.userId,
          username: sessionUser.username,
          fullName: sessionUser.fullName,
          phoneNumber: sessionUser.phoneNumber ?? '',
          email: sessionUser.email,
          defaultAddress: null,
          membershipTier: 'Standard',
          loyaltyPoints: 0,
          totalOrders: 0,
          totalSpent: 0,
          dateOfBirth: null,
          gender: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        this.errorMsg.set('Không xác thực được hồ sơ máy chủ (401). Vui lòng đăng nhập lại tài khoản khách hàng để xem giỏ hàng và đơn hàng.');
      } else {
        this.errorMsg.set('Không thể tải thông tin hồ sơ khách hàng.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  private applyProfile(data: CustomerProfile): void {
    this.profile.set(data);
    this.profileForm.patchValue({
      fullName: data.fullName || '',
      phoneNumber: data.phoneNumber || '',
      gender: data.gender || '',
      defaultAddress: data.defaultAddress || '',
    });
    this.addressForm.patchValue({
      receiverName: data.fullName || '',
      receiverPhone: data.phoneNumber || '',
    });
  }

  async onSaveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');
    try {
      const raw = this.profileForm.getRawValue();
      const updated = await this.authService.updateProfile({
        fullName: raw.fullName,
        phoneNumber: raw.phoneNumber || null,
        email: this.profile()?.email ?? null,
        dateOfBirth: this.profile()?.dateOfBirth ?? null,
        gender: raw.gender || null,
      });

      const savedStreet = raw.defaultAddress.trim();
      if (this.selectedProvinceId() && this.selectedWardId() && savedStreet) {
        await firstValueFrom(
          this.http.put(
            'http://localhost:5107/api/v1/customer/default-address',
            {
              receiverName: raw.fullName,
              receiverPhone: raw.phoneNumber || '',
              provinceId: this.selectedProvinceId(),
              wardId: this.selectedWardId(),
              streetAddress: savedStreet,
            },
            { withCredentials: true },
          ),
        );
      }

      this.applyProfile(updated);
      if (savedStreet) {
        this.profileForm.controls.defaultAddress.setValue(savedStreet);
      }
      this.isFallbackPreview.set(false);
      this.successMsg.set('Đã cập nhật thông tin hồ sơ thành công.');
    } catch (err) {
      if (err instanceof CustomerAuthApiError) {
        this.errorMsg.set(err.message);
      } else {
        this.errorMsg.set('Không thể cập nhật hồ sơ (hãy kiểm tra Backend API).');
      }
    } finally {
      this.saving.set(false);
    }
  }

  toggleChangePassword(): void {
    this.isChangingPassword.update((v) => !v);
    this.errorMsg.set('');
    this.successMsg.set('');
    if (!this.isChangingPassword()) {
      this.passwordForm.reset();
    }
  }

  async onSubmitChangePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.errorMsg.set('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới (tối thiểu 6 ký tự).');
      return;
    }
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.errorMsg.set('Mật khẩu xác nhận không khớp.');
      return;
    }
    this.errorMsg.set('');
    this.successMsg.set('');
    try {
      await firstValueFrom(
        this.http.post(
          'http://localhost:5107/api/v1/auth/change-password/request',
          { currentPassword, newPassword },
          { withCredentials: true },
        ),
      );
      this.successMsg.set('Đã gửi email xác nhận đổi mật khẩu. Vui lòng kiểm tra hộp thư.');
      this.passwordForm.reset();
    } catch {
      this.errorMsg.set('Mật khẩu hiện tại không đúng hoặc không thể gửi email.');
    }
  }

  toggleAddAddress(): void {
    this.isAddingAddress.update((v) => !v);
  }

  onAddDraftAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }
    const val = this.addressForm.getRawValue();
    const list = this.addresses();
    const shouldDefault = val.isDefault || list.length === 0;
    const nextList = list.map((a) => (shouldDefault ? { ...a, isDefault: false } : a));
    nextList.unshift({
      id: Date.now(),
      label: val.label,
      receiverName: val.receiverName,
      receiverPhone: val.receiverPhone,
      fullAddress: val.fullAddress,
      isDefault: shouldDefault,
    });
    this.addresses.set(nextList);
    this.isAddingAddress.set(false);
    this.addressForm.patchValue({ fullAddress: '' });
    this.successMsg.set('Đã thêm địa chỉ vào giao diện (sẽ lưu xuống DB khi nối API sổ địa chỉ).');
  }

  onRemoveDraftAddress(id: number): void {
    this.addresses.update((list) => list.filter((a) => a.id !== id));
  }

  async onLogout(): Promise<void> {
    await this.authService.logout();
    void this.router.navigateByUrl('/home');
  }

  navigateToHome(): void {
    void this.router.navigateByUrl('/home');
  }

  navigateToMenu(): void {
    void this.router.navigateByUrl('/san-pham');
  }

  async redeemVoucher(voucherId: number): Promise<void> {
    this.redeemingVoucherId.set(voucherId);
    this.errorMsg.set('');
    this.successMsg.set('');
    try {
      const remainingPoints = await this.orderService.redeemVoucher(voucherId);
      const cur = this.profile();
      if (cur) {
        this.profile.set({ ...cur, loyaltyPoints: remainingPoints });
      }
      this.successMsg.set('Đổi voucher thành công! Mã đã được lưu vào Ví Voucher.');
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        'Không đủ Điểm Fiin hoặc voucher đã hết lượt.';
      this.errorMsg.set(msg);
    } finally {
      this.redeemingVoucherId.set(null);
    }
  }

  async removeCartItem(cartItemId: number): Promise<void> {
    this.errorMsg.set('');
    try {
      await this.orderService.removeCartItem(cartItemId);
    } catch {
      this.errorMsg.set('Không thể xóa món khỏi giỏ hàng.');
    }
  }

  async placeOrder(): Promise<void> {
    if (this.cartItems().length === 0) return;
    this.placingOrder.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');
    try {
      const result = await this.orderService.placeOrder(
        this.selectedOrderType(),
        this.selectedCustomerVoucherId(),
        1
      );
      this.selectedCustomerVoucherId.set(null);
      await this.refreshProfileSilent();
      this.activeTab.set('orders');
      this.successMsg.set(
        `Đặt hàng thành công! Mã đơn ${result.orderCode} (${result.totalAmount.toLocaleString('vi-VN')}đ).`
      );
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        'Đặt hàng thất bại. Vui lòng thử lại.';
      this.errorMsg.set(msg);
    } finally {
      this.placingOrder.set(false);
    }
  }

  async cancelOrReturnOrder(order: CustomerOrderDto): Promise<void> {
    const isCancellable = order.orderStatus === 'Pending' || order.orderStatus === 'Confirmed';
    const promptLabel = isCancellable
      ? `Nhập lý do hủy đơn ${order.orderCode}:`
      : `Đơn ${order.orderCode} đã qua bước pha chế. Nhập lý do yêu cầu trả món:`;
    const reason = window.prompt(promptLabel, isCancellable ? 'Đổi ý đặt món' : 'Món chưa đúng yêu cầu');
    if (reason === null) return;

    this.cancellingOrderId.set(order.orderId);
    this.errorMsg.set('');
    this.successMsg.set('');
    try {
      const msg = await this.orderService.cancelOrReturnOrder(order.orderId, reason.trim() || 'Khách yêu cầu');
      await this.orderService.loadVoucherWallet();
      this.successMsg.set(msg);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        'Không thể xử lý yêu cầu hủy/trả món.';
      this.errorMsg.set(msg);
    } finally {
      this.cancellingOrderId.set(null);
    }
  }

  orderStatusLabel(status: string): string {
    switch (status) {
      case 'Pending':
        return 'Lên món (Chờ pha chế)';
      case 'Confirmed':
        return 'Đã xác nhận';
      case 'Processing':
        return 'Đang làm món';
      case 'Ready':
        return 'Đã pha xong';
      case 'Delivering':
        return 'Đang giao món';
      case 'Completed':
        return 'Hoàn thành';
      case 'Cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  }

  canCancelDirectly(status: string): boolean {
    return status === 'Pending' || status === 'Confirmed';
  }

  canRequestReturn(status: string): boolean {
    return status === 'Processing' || status === 'Ready' || status === 'Delivering';
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
  }
}