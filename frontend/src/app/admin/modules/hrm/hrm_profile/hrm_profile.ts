import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAlertCircle,
  LucideAward,
  LucideBuilding,
  LucideChevronDown,
  LucideChevronUp,
  LucideCreditCard,
  LucideEye,
  LucideEyeOff,
  LucideFileText,
  LucideLock,
  LucideMail,
  LucidePencil,
  LucidePhone,
  LucidePlus,
  LucideSave,
  LucideSearch,
  LucideUser,
  LucideUserCheck,
  LucideX,
} from '@lucide/angular';
import { AdminSession } from '../../../core/admin_session';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { BadgeVariant } from '../../../shared/admin_status_badge/admin_status_badge';
import { AdminFormField } from '../../../shared/admin_form_field/admin_form_field';
import { ContractType, CreateEmployeeDto, Employee, EmployeeFullProfile, UpdateEmployeeProfileDto } from '../models/employee';
import { HrmEmployeeApi, getPositionLevel } from '../services/hrm_employee_api';

@Component({
  selector: 'app-hrm-profile',
  templateUrl: './hrm_profile.html',
  styleUrl: './hrm_profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideUser,
    LucideBuilding,
    LucideCreditCard,
    LucideFileText,
    LucideLock,
    LucidePlus,
    LucideSave,
    LucideX,
    LucidePencil,
    LucideAlertCircle,
    LucidePhone,
    LucideMail,
    LucideAward,
    LucideEye,
    LucideEyeOff,
    LucideSearch,
    LucideChevronDown,
    LucideChevronUp,
    LucideUserCheck,
    AdminFormField,
  ],
})
export class HrmProfile {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly adminSession = inject(AdminSession);
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);

  readonly employee = signal<Employee | null>(null);
  readonly fullProfile = signal<EmployeeFullProfile | null>(null);
  readonly isLoading = signal(false);
  readonly isCreateMode = signal(false);
  readonly isEditing = signal(false);
  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly accessDenied = signal(false);
  readonly accessDeniedMessage = signal('');

  // Danh sách nhân sự để tra cứu nhanh trên Combobox (Phân quyền cây phả hệ & Phân trang lười)
  readonly accessibleEmployees = signal<Employee[]>([]);
  readonly comboboxSearch = signal('');
  readonly isComboboxOpen = signal(false);
  readonly comboboxPage = signal(1);
  readonly comboboxTotal = signal(0);
  readonly isComboboxLoadingMore = signal(false);

  // Trạng thái đóng/mở (Collapse / Expand) của 5 khối thông tin
  readonly openSections = signal<Record<string, boolean>>({
    info: true,
    bank: true,
    contract: true,
    workflow: true,
    note: true,
  });

  // Quyền xem/chuyển đổi hồ sơ nhân viên khác (chỉ khi có quyền HRM_EMPLOYEE và cấp >= 3)
  readonly canViewOthers = computed(() => {
    const user = this.adminSession.user();
    if (!user) return false;
    return this.adminSession.hasPermission('HRM_EMPLOYEE') && this.currentUserLevel() >= 3;
  });

  // Quyền tạo nhân viên mới: Phải từ cấp 3 trở lên và có quyền HRM_EMPLOYEE
  readonly canCreateEmployee = computed(() => this.canViewOthers());

  // Cấp bậc phân quyền của nhân viên đang xem (1 -> 5)
  readonly employeeLevel = computed(() => {
    const fp = this.fullProfile();
    if (fp && fp.hierarchyLevel) return fp.hierarchyLevel;
    const emp = this.employee();
    return emp ? getPositionLevel(emp.position) : 1;
  });

  // Cấp bậc phân quyền của người đang đăng nhập (1 -> 5)
  readonly currentUserLevel = computed(() => {
    const user = this.adminSession.user();
    if (!user) return 1;
    return user.hierarchyLevel && user.hierarchyLevel > 0
      ? user.hierarchyLevel
      : getPositionLevel(user.role);
  });

  // Danh sách nhân viên trong combobox (đã được lọc từ server hoặc fallback)
  readonly filteredEmployees = computed(() => {
    const list = this.accessibleEmployees();
    const q = this.comboboxSearch().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.employeeCode && e.employeeCode.toLowerCase().includes(q)) ||
        e.position.toLowerCase().includes(q) ||
        (e.phoneNumber && e.phoneNumber.includes(q)) ||
        (e.citizenId && e.citizenId.includes(q))
    );
  });

  // Form tạo nhân viên mới (chỉ Họ tên + SĐT bắt buộc; chi nhánh/chức vụ/hợp đồng thiết lập ở mục khác)
  readonly employeeForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9\s]{9,12}$/)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    dateOfBirth: new FormControl('2001-01-01', { nonNullable: true }),
    gender: new FormControl<'male' | 'female' | 'other'>('male', { nonNullable: true }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.minLength(3)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.minLength(6)] }),
    citizenId: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[0-9]{12}$/)] }),
    bankName: new FormControl('', { nonNullable: true }),
    bankAccountNumber: new FormControl('', { nonNullable: true }),
    bankAccountName: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  // Form chỉnh sửa thông tin nhân viên tại chỗ (in-place)
  readonly editForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9\s]{9,12}$/)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    dateOfBirth: new FormControl('2001-01-01', { nonNullable: true }),
    gender: new FormControl<'male' | 'female' | 'other'>('male', { nonNullable: true }),
    citizenId: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[0-9]{12}$/)] }),
    status: new FormControl('active', { nonNullable: true }),
    position: new FormControl('', { nonNullable: true }),
    branchId: new FormControl<number>(0, { nonNullable: true }),
    bankName: new FormControl('', { nonNullable: true }),
    bankAccountNumber: new FormControl('', { nonNullable: true }),
    bankAccountName: new FormControl('', { nonNullable: true }),
    contractTypeId: new FormControl<number>(0, { nonNullable: true }),
    hourlyRate: new FormControl<number>(0, { nonNullable: true }),
    allowance: new FormControl<number>(0, { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  readonly contractTypes = signal<ContractType[]>([]);
  readonly branches = signal<Array<{ branchId: number; branchCode?: string; branchName: string }>>([]);
  readonly monthlySalaryInput = signal<number>(0);

  constructor() {
    this.loadAccessibleEmployees(true);
    this.employeeApi.getContractTypes().subscribe((types) => this.contractTypes.set(types));
    this.employeeApi.getBranches().subscribe((list) => this.branches.set(list));

    this.route.queryParamMap.subscribe((params) => {
      const mode = params.get('mode');
      const id = params.get('id');

      if (mode === 'create') {
        if (this.canCreateEmployee()) {
          this.openCreateMode();
        } else {
          this.toastService.warning('Bạn không có quyền quản lý để tạo nhân viên mới.');
          this.isCreateMode.set(false);
          this.loadEmployeeProfile(id);
        }
      } else {
        this.isCreateMode.set(false);
        this.loadEmployeeProfile(id);
      }
    });
  }

  /**
   * Phân trang lười Combobox: Tải 50 nhân viên đầu tiên, khi cuộn xuống đáy tải tiếp 10 nhân viên
   */
  loadAccessibleEmployees(reset = true): void {
    if (!this.canViewOthers()) {
      this.accessibleEmployees.set([]);
      this.comboboxTotal.set(0);
      return;
    }

    if (reset) {
      this.comboboxPage.set(1);
    }

    const page = this.comboboxPage();
    const pageSize = page === 1 ? 50 : 10;
    const currentUser = this.adminSession.user();
    const currentUsername = currentUser?.username || (currentUser?.email ? currentUser.email.split('@')[0] : (currentUser?.name || 'admin'));

    this.isComboboxLoadingMore.set(true);
    this.employeeApi
      .getEmployeesByHierarchy({
        currentUsername,
        search: this.comboboxSearch().trim(),
        pageIndex: page,
        pageSize,
      })
      .subscribe({
        next: (res) => {
          this.isComboboxLoadingMore.set(false);
          this.comboboxTotal.set(res.total);
          if (reset) {
            this.accessibleEmployees.set(res.items);
          } else {
            this.accessibleEmployees.update((list) => {
              const existingCodes = new Set(list.map((e) => e.employeeCode || e.code));
              const newItems = res.items.filter((e) => !existingCodes.has(e.employeeCode || e.code));
              return [...list, ...newItems];
            });
          }
        },
        error: () => this.isComboboxLoadingMore.set(false),
      });
  }

  onComboboxScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    if (atBottom && !this.isComboboxLoadingMore() && this.accessibleEmployees().length < this.comboboxTotal()) {
      this.comboboxPage.update((p) => p + 1);
      this.loadAccessibleEmployees(false);
    }
  }

  onComboboxSearchInput(val: string): void {
    this.comboboxSearch.set(val);
    this.loadAccessibleEmployees(true);
  }

  loadEmployeeProfile(targetId: string | null): void {
    this.isEditing.set(false);
    this.isLoading.set(true);
    this.accessDenied.set(false);
    this.accessDeniedMessage.set('');

    const currentUser = this.adminSession.user();
    const myEmpId = currentUser?.employeeId;

    // Nếu không có quyền xem nhân viên khác -> luôn mở thẳng hồ sơ cá nhân của chính mình
    if (!this.canViewOthers()) {
      if (myEmpId) {
        this.employeeApi.getFullProfile(myEmpId).subscribe({
          next: (profile) => {
            if (profile) {
              this.fullProfile.set(profile);
              this.employee.set(this.profileToEmployee(profile));
              this.isLoading.set(false);
            } else {
              this.loadDefaultProfile();
            }
          },
          error: () => this.loadDefaultProfile(),
        });
      } else {
        this.loadDefaultProfile();
      }
      return;
    }

    const resolveProfile = (empId: string | number) => {
      this.employeeApi.getFullProfile(empId).subscribe({
        next: (profile) => {
          if (!profile) {
            this.loadDefaultProfile();
            return;
          }

          const myLevel = this.currentUserLevel();
          const targetLevel = profile.hierarchyLevel || getPositionLevel(profile.position || '');

          if (targetLevel > myLevel) {
            this.toastService.warning(
              `Bạn không có quyền xem hồ sơ cấp cao hơn ("${profile.fullName}" - Cấp ${targetLevel}). Đã chuyển về hồ sơ của bạn.`
            );
            this.loadDefaultProfile();
            return;
          }

          this.fullProfile.set(profile);
          this.employee.set(this.profileToEmployee(profile));
          this.isLoading.set(false);
        },
        error: () => this.loadDefaultProfile(),
      });
    };

    if (targetId) {
      resolveProfile(targetId);
    } else if (myEmpId) {
      resolveProfile(myEmpId);
    } else {
      this.employeeApi.getProfileForUser(currentUser).subscribe({
        next: (emp) => {
          const id = emp.employeeId || emp.code || 1;
          resolveProfile(id);
        },
        error: () => resolveProfile(1),
      });
    }
  }

  loadDefaultProfile(): void {
    const currentUser = this.adminSession.user();
    if (currentUser?.employeeId) {
      this.employeeApi.getFullProfile(currentUser.employeeId).subscribe({
        next: (profile) => {
          if (profile) {
            this.fullProfile.set(profile);
            this.employee.set(this.profileToEmployee(profile));
          }
          this.accessDenied.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.accessDenied.set(false);
          this.isLoading.set(false);
        },
      });
      return;
    }

    this.employeeApi.getProfileForUser(currentUser).subscribe({
      next: (emp) => {
        const id = emp.employeeId || emp.code || 1;
        this.employeeApi.getFullProfile(id).subscribe({
          next: (profile) => {
            if (profile) {
              this.fullProfile.set(profile);
              this.employee.set(this.profileToEmployee(profile));
            } else {
              this.employee.set(emp);
            }
            this.accessDenied.set(false);
            this.isLoading.set(false);
          },
          error: () => {
            this.employee.set(emp);
            this.accessDenied.set(false);
            this.isLoading.set(false);
          },
        });
      },
      error: () => this.isLoading.set(false),
    });
  }

  private profileToEmployee(p: EmployeeFullProfile): Employee {
    const pos = p.roleName === 'Admin' ? 'Quản trị viên toàn hệ thống' :
      p.hierarchyLevel === 4 ? 'Trưởng phòng Nhân sự' :
      p.hierarchyLevel === 3 ? 'Quản lý Cửa hàng' :
      p.hierarchyLevel === 2 ? 'Trưởng ca Pha chế' : 'Barista Chuyên nghiệp';

    return {
      id: String(p.employeeId),
      employeeId: p.employeeId,
      code: p.employeeCode,
      employeeCode: p.employeeCode,
      fullName: p.fullName,
      phone: p.phoneNumber || '',
      phoneNumber: p.phoneNumber || '',
      email: p.email || '',
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '1998-04-12',
      gender: p.gender || 'male',
      position: pos,
      branchId: p.branchCode ? p.branchCode.toLowerCase() : 'cn-q1',
      branchCode: p.branchCode,
      branchName: p.branchName || 'Fiin Coffee',
      status: p.status || 'active',
      startDate: p.hireDate ? new Date(p.hireDate).toLocaleDateString('vi-VN') : '15/01/2025',
      contractType: p.contractCode === 'HD-PART-TIME' ? 'part_time' : 'full_time',
      hourlyRate: p.hourlyRate || 35000,
      note: p.note,
      citizenId: p.citizenId,
      bankName: p.bankName,
      bankAccountNumber: p.bankAccountNumber,
      bankAccountName: p.bankAccountName,
      contractTypeId: p.contractTypeId,
      contractCode: p.contractCode,
      contractName: p.contractName,
      allowance: p.allowance,
      benefitsDescription: p.benefitsDescription,
      username: p.username,
      hierarchyLevel: p.hierarchyLevel,
    };
  }

  // ==========================================
  // COMBOBOX EMPLOYEE SELECTOR ACTIONS
  // ==========================================
  toggleCombobox(): void {
    this.isComboboxOpen.update((open) => !open);
    if (this.isComboboxOpen()) {
      this.comboboxSearch.set('');
    }
  }

  closeCombobox(): void {
    this.isComboboxOpen.set(false);
  }

  selectEmployee(emp: Employee): void {
    this.isEditing.set(false);
    this.isComboboxOpen.set(false);
    this.comboboxSearch.set('');
    const id = emp.employeeCode || emp.code || emp.employeeId;
    void this.router.navigate([], { queryParams: { id } });
  }

  viewMyOwnProfile(): void {
    this.isEditing.set(false);
    this.isComboboxOpen.set(false);
    this.comboboxSearch.set('');
    void this.router.navigate([], { queryParams: {} });
  }

  // ==========================================
  // COLLAPSIBLE (ACCORDION) SECTIONS
  // ==========================================
  toggleSection(sectionKey: string): void {
    this.openSections.update((curr) => ({
      ...curr,
      [sectionKey]: !curr[sectionKey],
    }));
  }

  expandAllSections(): void {
    this.openSections.set({
      info: true,
      bank: true,
      contract: true,
      workflow: true,
      note: true,
    });
  }

  collapseAllSections(): void {
    this.openSections.set({
      info: false,
      bank: false,
      contract: false,
      workflow: false,
      note: false,
    });
  }

  // ==========================================
  // SYMBOLIC ACTIONS (EXCEL / WORD EXPORT)
  // ==========================================
  onImportExcel(): void {
    this.toastService.info('Tính năng nhập hàng loạt nhân sự từ file Excel đang được phát triển.');
  }

  onExportDoc(): void {
    this.toastService.info('Tính năng xuất hồ sơ nhân sự ra file Word (Docx) / Excel đang được phát triển.');
  }

  // ==========================================
  // IN-PLACE EDIT PROFILE ACTIONS
  // ==========================================
  startEditingSection(sectionKey: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const emp = this.employee();
    if (!emp) return;

    // Tự động mở rộng khối cần chỉnh sửa nếu đang đóng
    this.openSections.update((curr) => ({
      ...curr,
      [sectionKey]: true,
    }));

    // Nạp dữ liệu hiện tại của nhân sự vào editForm
    this.editForm.patchValue({
      fullName: emp.fullName || '',
      phone: emp.phoneNumber || emp.phone || '',
      email: emp.email || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '2001-01-01',
      gender: (emp.gender as 'male' | 'female' | 'other') || 'male',
      citizenId: emp.citizenId || '',
      status: emp.status || 'active',
      position: emp.position || '',
      branchId: emp.numericBranchId || Number(emp.branchId) || 0,
      bankName: emp.bankName || '',
      bankAccountNumber: emp.bankAccountNumber || '',
      bankAccountName: emp.bankAccountName || emp.fullName || '',
      contractTypeId: emp.contractTypeId || 0,
      hourlyRate: emp.hourlyRate || 0,
      allowance: emp.allowance || 0,
      note: emp.note || '',
    });
    this.monthlySalaryInput.set(Math.round((emp.hourlyRate || 0) * 208));

    this.isEditing.set(true);
  }

  isMonthlyContract(contractCode?: string, contractName?: string): boolean {
    const text = `${contractCode || ''} ${contractName || ''}`.toUpperCase();
    if (!text.trim()) return false;
    return !(
      text.includes('PART') ||
      text.includes('BÁN THỜI GIAN') ||
      text.includes('THỜI VỤ') ||
      text.includes('THEO GIỜ') ||
      text.includes('THANH LÝ') ||
      text.includes('THÔI VIỆC')
    );
  }

  isEditingMonthlyContract(): boolean {
    const typeId = Number(this.editForm.controls.contractTypeId.value);
    const found = this.contractTypes().find((t) => t.contractTypeId === typeId);
    if (!found) return false;
    return this.isMonthlyContract(found.contractCode, found.contractName);
  }

  onEditContractTypeChange(): void {
    const typeId = Number(this.editForm.controls.contractTypeId.value);
    const found = this.contractTypes().find((t) => t.contractTypeId === typeId);
    if (!found) return;
    if (found.standardHourlyRate > 0) {
      this.editForm.controls.hourlyRate.setValue(found.standardHourlyRate);
      this.monthlySalaryInput.set(Math.round(found.standardHourlyRate * 208));
    }
    this.editForm.controls.allowance.setValue(found.allowance || 0);
  }

  onMonthlySalaryInput(val: number): void {
    const monthly = Math.max(0, Number(val) || 0);
    this.monthlySalaryInput.set(monthly);
    this.editForm.controls.hourlyRate.setValue(Math.round(monthly / 208));
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.editForm.reset();
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.toastService.error('Vui lòng kiểm tra lại thông tin: Họ tên và SĐT là bắt buộc, CCCD (nếu có) phải đủ 12 số.');
      return;
    }

    const emp = this.employee();
    if (!emp) return;

    const empId = emp.employeeId || parseInt(String(emp.code).replace(/\D/g, ''), 10) || 1;
    const raw = this.editForm.getRawValue();

    this.isSubmitting.set(true);
    const payload: UpdateEmployeeProfileDto = {
      fullName: raw.fullName.trim(),
      phoneNumber: raw.phone.trim() || undefined,
      email: raw.email.trim() || undefined,
      dateOfBirth: raw.dateOfBirth ? raw.dateOfBirth : null,
      gender: raw.gender,
      citizenId: raw.citizenId.trim() || undefined,
      status: raw.status,
      position: raw.position.trim() || undefined,
      branchId: raw.branchId > 0 ? raw.branchId : undefined,
      bankName: raw.bankName.trim() || undefined,
      bankAccountNumber: raw.bankAccountNumber.trim() || undefined,
      bankAccountName: raw.bankAccountNumber.trim()
        ? (raw.bankAccountName.trim() || raw.fullName.trim()).toUpperCase()
        : undefined,
      contractTypeId: raw.contractTypeId > 0 ? raw.contractTypeId : undefined,
      hourlyRate: raw.hourlyRate,
      allowance: raw.allowance,
      note: raw.note.trim() || undefined,
    };

    this.employeeApi.updateEmployeeProfile(empId, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isEditing.set(false);
        this.toastService.success(`Đã cập nhật thông tin hồ sơ nhân sự "${raw.fullName.trim()}" thành công!`);

        // Tải lại dữ liệu hồ sơ mới nhất
        this.loadEmployeeProfile(emp.employeeCode || emp.code || String(empId));
        this.loadAccessibleEmployees(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error(err.message || 'Lỗi khi cập nhật thông tin nhân viên');
      },
    });
  }

  // ==========================================
  // CREATE EMPLOYEE FORM ACTIONS
  // ==========================================
  openCreateMode(): void {
    this.isEditing.set(false);
    this.isCreateMode.set(true);
    this.accessDenied.set(false);
    this.isComboboxOpen.set(false);

    this.employeeForm.reset({
      fullName: '',
      phone: '',
      email: '',
      dateOfBirth: '2001-01-01',
      gender: 'male',
      username: '',
      password: '',
      citizenId: '',
      bankName: '',
      bankAccountNumber: '',
      bankAccountName: '',
      note: '',
    });
  }

  cancelCreate(): void {
    this.isCreateMode.set(false);
    void this.router.navigate([], {
      queryParams: { id: this.employee()?.employeeId || this.employee()?.code || null },
    });
  }

  saveEmployee(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      this.toastService.error('Vui lòng kiểm tra lại thông tin: Họ tên và SĐT là bắt buộc, các trường còn lại phải đúng định dạng nếu có nhập.');
      return;
    }

    this.isSubmitting.set(true);
    const val = this.employeeForm.getRawValue();
    const hasBankAccount = !!val.bankAccountNumber.trim();

    // Chi nhánh, chức vụ, hợp đồng, mức lương không gửi từ form này (thiết lập ở mục khác)
    const payload = {
      username: val.username.trim() || undefined,
      password: val.password || undefined,
      fullName: val.fullName.trim(),
      phoneNumber: val.phone.trim() || undefined,
      email: val.email.trim() || undefined,
      dateOfBirth: val.dateOfBirth ? val.dateOfBirth : null,
      gender: val.gender,
      citizenId: val.citizenId.trim() || undefined,
      bankName: val.bankName.trim() || undefined,
      bankAccountNumber: val.bankAccountNumber.trim() || undefined,
      bankAccountName: hasBankAccount
        ? (val.bankAccountName.trim() || val.fullName.trim()).toUpperCase()
        : undefined,
      note: val.note.trim() || undefined,
    } as CreateEmployeeDto;

    this.employeeApi.createEmployee(payload).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.toastService.success(`Đã thêm nhân viên "${created.fullName}" thành công! Mã hồ sơ: ${created.employeeCode || created.code}`);
        this.isCreateMode.set(false);
        this.employee.set(created);
        this.loadAccessibleEmployees();
        void this.router.navigate([], {
          queryParams: { id: created.employeeCode || created.code },
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error(err.message || 'Lỗi khi tạo nhân viên mới');
      },
    });
  }

  // ==========================================
  // BADGE & HELPER FORMATTERS
  // ==========================================
  getStatusBadge(status?: string): { label: string; variant: BadgeVariant } {
    switch (status) {
      case 'active':
      case 'working':
        return { label: 'Đang làm việc', variant: 'success' };
      case 'probation':
        return { label: 'Đang thử việc', variant: 'warning' };
      case 'resigned':
        return { label: 'Đã thôi việc', variant: 'danger' };
      default:
        return { label: status || 'Hoạt động', variant: 'neutral' };
    }
  }

  getHierarchyBadge(pos?: string): { title: string; level: number; variant: BadgeVariant; desc: string } {
    const level = getPositionLevel(pos || '');
    switch (level) {
      case 5:
        return {
          title: 'Cấp 5 · Giám đốc / Ban Điều hành',
          level: 5,
          variant: 'danger',
          desc: 'Toàn quyền kiểm soát hệ thống, phê duyệt ngân sách và duyệt chi cấp chuỗi.',
        };
      case 4:
        return {
          title: 'Cấp 4 · Trưởng phòng Nhân sự (HRM)',
          level: 4,
          variant: 'warning',
          desc: 'Quản trị nhân sự toàn hệ thống, đối soát bảng lương và định biên nhân sự.',
        };
      case 3:
        return {
          title: 'Cấp 3 · Quản lý Cửa hàng (Store Manager)',
          level: 3,
          variant: 'info',
          desc: 'Quản lý vận hành chi nhánh, thẩm định tuyển dụng và duyệt đơn chi nhánh.',
        };
      case 2:
        return {
          title: 'Cấp 2 · Trưởng ca Vận hành (Shift Leader)',
          level: 2,
          variant: 'success',
          desc: 'Điều phối ca trực, chốt chấm công hàng ngày, duyệt đơn đổi ca/nghỉ phép ngắn.',
        };
      default:
        return {
          title: 'Cấp 1 · Nhân viên Quầy / Pha chế / Thu ngân',
          level: 1,
          variant: 'neutral',
          desc: 'Nhân viên thực hiện nghiệp vụ quầy pha chế, thu ngân và phục vụ.',
        };
    }
  }
}
