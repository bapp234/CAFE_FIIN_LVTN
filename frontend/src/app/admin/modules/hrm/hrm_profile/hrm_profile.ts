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
  LucideArrowLeft,
  LucideAward,
  LucideBuilding,
  LucideCheck,
  LucideChevronDown,
  LucideChevronUp,
  LucideCreditCard,
  LucideDownload,
  LucideEye,
  LucideEyeOff,
  LucideFileText,
  LucideLock,
  LucideMail,
  LucidePhone,
  LucidePlus,
  LucideSearch,
  LucideShield,
  LucideUpload,
  LucideUser,
  LucideUserCheck,
} from '@lucide/angular';
import { AdminSession } from '../../../core/admin_session';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminStatusBadge, BadgeVariant } from '../../../shared/admin_status_badge/admin_status_badge';
import { AdminFormField } from '../../../shared/admin_form_field/admin_form_field';
import { ContractType, CreateEmployeeDto, Employee, EmployeeFullProfile } from '../models/employee';
import { FALLBACK_CONTRACT_TYPES, HrmEmployeeApi, getPositionLevel } from '../services/hrm_employee_api';

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
    LucideShield,
    LucideLock,
    LucidePlus,
    LucideArrowLeft,
    LucideCheck,
    LucideAlertCircle,
    LucidePhone,
    LucideMail,
    LucideAward,
    LucideEye,
    LucideEyeOff,
    LucideSearch,
    LucideUpload,
    LucideDownload,
    LucideChevronDown,
    LucideChevronUp,
    LucideUserCheck,
    AdminStatusBadge,
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
  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly accessDenied = signal(false);
  readonly accessDeniedMessage = signal('');

  // Danh mục Hợp đồng lao động
  readonly contractTypes = signal<ContractType[]>([]);
  readonly selectedContract = signal<ContractType | null>(null);

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

  // Quyền tạo nhân viên mới: Phải từ cấp 3 trở lên (StoreManager, HRM, Admin)
  readonly canCreateEmployee = computed(() => {
    const user = this.adminSession.user();
    if (!user) return false;
    return getPositionLevel(user.role) >= 3;
  });

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
    return user ? getPositionLevel(user.role) : 1;
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

  // Form tạo nhân viên mới
  readonly employeeForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9\s]{9,12}$/)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    dateOfBirth: new FormControl('2001-01-01', { nonNullable: true }),
    gender: new FormControl<'male' | 'female' | 'other'>('male', { nonNullable: true }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    password: new FormControl('Fiin@2026', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    citizenId: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9]{12}$/)] }),
    bankName: new FormControl('Vietcombank', { nonNullable: true }),
    bankAccountNumber: new FormControl('', { nonNullable: true }),
    bankAccountName: new FormControl('', { nonNullable: true }),
    branchId: new FormControl('cn-q1', { nonNullable: true, validators: [Validators.required] }),
    position: new FormControl('Barista Chuyên nghiệp', { nonNullable: true, validators: [Validators.required] }),
    contractTypeId: new FormControl(3, { nonNullable: true, validators: [Validators.required] }),
    hourlyRate: new FormControl(28000, { nonNullable: true, validators: [Validators.required, Validators.min(20000)] }),
    note: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.loadContractTypes();
    this.loadAccessibleEmployees(true);

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
    if (reset) {
      this.comboboxPage.set(1);
    }

    const page = this.comboboxPage();
    const pageSize = page === 1 ? 50 : 10;
    const currentUser = this.adminSession.user();
    const currentUsername = currentUser?.email ? currentUser.email.split('@')[0] : (currentUser?.name || 'admin');

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

  loadContractTypes(): void {
    this.employeeApi.getContractTypes().subscribe({
      next: (types) => {
        this.contractTypes.set(types);
        if (types.length > 0 && !this.selectedContract()) {
          const defaultContract = types.find((t) => t.contractTypeId === 3) || types[0];
          this.selectedContract.set(defaultContract);
        }
      },
    });
  }

  loadEmployeeProfile(targetId: string | null): void {
    this.isLoading.set(true);
    this.accessDenied.set(false);
    this.accessDeniedMessage.set('');

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
            this.accessDenied.set(true);
            this.accessDeniedMessage.set(
              `Theo phân quyền cây phả hệ, bạn (${this.adminSession.user()?.role || 'Nhân viên'} - Cấp ${myLevel}) không được phép xem hồ sơ nhân sự cấp cao hơn: "${profile.fullName}" (Cấp ${targetLevel}).`
            );
            const fallbackEmp = this.profileToEmployee(profile);
            this.employee.set(fallbackEmp);
            this.fullProfile.set(profile);
            this.isLoading.set(false);
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
    } else {
      const currentUser = this.adminSession.user();
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
    this.isComboboxOpen.set(false);
    this.comboboxSearch.set('');
    const id = emp.employeeCode || emp.code || emp.employeeId;
    void this.router.navigate([], { queryParams: { id } });
  }

  viewMyOwnProfile(): void {
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
  // CREATE EMPLOYEE FORM ACTIONS
  // ==========================================
  openCreateMode(): void {
    this.isCreateMode.set(true);
    this.accessDenied.set(false);
    this.isComboboxOpen.set(false);

    const defaultBranch =
      this.branchService.selectedBranchId() === 'all' ? 'cn-q1' : this.branchService.selectedBranchId();
    const defaultContract = this.contractTypes().find((t) => t.contractTypeId === 3) || this.contractTypes()[0];
    this.selectedContract.set(defaultContract || null);

    this.employeeForm.reset({
      fullName: '',
      phone: '',
      email: '',
      dateOfBirth: '2001-01-01',
      gender: 'male',
      username: '',
      password: 'Fiin@2026',
      citizenId: '',
      bankName: 'Vietcombank',
      bankAccountNumber: '',
      bankAccountName: '',
      branchId: defaultBranch,
      position: 'Barista Chuyên nghiệp',
      contractTypeId: defaultContract ? defaultContract.contractTypeId : 3,
      hourlyRate: defaultContract ? Number(defaultContract.standardHourlyRate) : 28000,
      note: '',
    });
  }

  cancelCreate(): void {
    this.isCreateMode.set(false);
    void this.router.navigate([], {
      queryParams: { id: this.employee()?.employeeId || this.employee()?.code || null },
    });
  }

  onContractTypeChange(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    const contract = this.contractTypes().find((c) => c.contractTypeId === id) ?? null;
    this.selectedContract.set(contract);

    if (contract && contract.standardHourlyRate) {
      this.employeeForm.patchValue({
        contractTypeId: contract.contractTypeId,
        hourlyRate: Number(contract.standardHourlyRate),
      });
    }
  }

  saveEmployee(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      this.toastService.error('Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, SĐT, Username, Mật khẩu, CCCD 12 số)!');
      return;
    }

    this.isSubmitting.set(true);
    const val = this.employeeForm.getRawValue();

    let numericBranchId = 1;
    if (val.branchId === 'cn-q3') numericBranchId = 2;
    else if (val.branchId === 'cn-td') numericBranchId = 3;
    else if (val.branchId === 'cn-bt') numericBranchId = 4;
    else if (!isNaN(Number(val.branchId))) numericBranchId = Number(val.branchId);

    const payload: CreateEmployeeDto = {
      username: val.username.trim(),
      password: val.password,
      fullName: val.fullName.trim(),
      phoneNumber: val.phone.trim() || undefined,
      email: val.email.trim() || undefined,
      dateOfBirth: val.dateOfBirth ? val.dateOfBirth : null,
      gender: val.gender,
      citizenId: val.citizenId.trim(),
      bankName: val.bankName.trim() || undefined,
      bankAccountNumber: val.bankAccountNumber.trim() || undefined,
      bankAccountName: val.bankAccountName ? val.bankAccountName.trim().toUpperCase() : val.fullName.trim().toUpperCase(),
      branchId: numericBranchId,
      position: val.position,
      contractTypeId: Number(val.contractTypeId),
      hourlyRate: Number(val.hourlyRate),
      note: val.note.trim() || undefined,
      roleId: this.getRoleIdByPosition(val.position),
    };

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

  private getRoleIdByPosition(pos: string): number {
    switch (pos) {
      case 'Quản lý Cửa hàng':
        return 3;
      case 'Trưởng ca Pha chế':
      case 'Trưởng ca Cửa hàng':
        return 6;
      case 'Nhân viên Thu ngân':
        return 4;
      default:
        return 5;
    }
  }
}
