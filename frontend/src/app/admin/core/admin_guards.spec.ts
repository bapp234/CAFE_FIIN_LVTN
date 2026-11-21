import { TestBed } from '@angular/core/testing';
import { Route, Router } from '@angular/router';
import { adminAuthGuard, adminGuestGuard, adminHomeGuard, adminModuleGuard } from './admin_guards';
import { AdminAuthService } from './admin_auth_service';
import { AdminSession } from './admin_session';

describe('Admin Permissions & Guards (Giai đoạn 1 & 2)', () => {
  let session: AdminSession;
  let authService: AdminAuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    session = TestBed.inject(AdminSession);
    authService = TestBed.inject(AdminAuthService);
    router = TestBed.inject(Router);
  });

  describe('Case 1: User has all modules [cms, crm, hrm, erp]', () => {
    beforeEach(() => {
      session.user.set({
        id: 'u1',
        name: 'Nguyễn Văn An',
        email: 'admin@fiin.vn',
        role: 'Quản trị viên',
        modules: ['cms', 'crm', 'hrm', 'erp'],
      });
    });

    it('should have 4 allowed modules in order', () => {
      const keys = session.allowedModules().map((m) => m.key);
      expect(keys).toEqual(['cms', 'crm', 'hrm', 'erp']);
    });

    it('adminAuthGuard should allow access', () => {
      const result = TestBed.runInInjectionContext(() => adminAuthGuard({} as any, {} as any));
      expect(result).toBe(true);
    });

    it('adminHomeGuard should redirect to /admin/cms', () => {
      const tree = TestBed.runInInjectionContext(() => adminHomeGuard({} as any, {} as any));
      expect(router.serializeUrl(tree as any)).toBe('/admin/cms');
    });

    it('adminModuleGuard should allow all 4 modules', () => {
      for (const mod of ['cms', 'crm', 'hrm', 'erp'] as const) {
        const route: Route = { data: { module: mod } };
        const allowed = TestBed.runInInjectionContext(() => adminModuleGuard(route, []));
        expect(allowed).toBe(true);
      }
    });

    it('adminGuestGuard should redirect authenticated user away from /admin/login to /admin', () => {
      const tree = TestBed.runInInjectionContext(() => adminGuestGuard({} as any, {} as any));
      expect(router.serializeUrl(tree as any)).toBe('/admin');
    });
  });

  describe('Case 2: User has only [hrm]', () => {
    beforeEach(() => {
      session.user.set({
        id: 'u2',
        name: 'Nhân Sự',
        email: 'hr@fiin.vn',
        role: 'Quản lý nhân sự',
        modules: ['hrm'],
      });
    });

    it('should have only hrm allowed', () => {
      const keys = session.allowedModules().map((m) => m.key);
      expect(keys).toEqual(['hrm']);
      expect(session.can('hrm')).toBe(true);
      expect(session.can('cms')).toBe(false);
      expect(session.can('crm')).toBe(false);
      expect(session.can('erp')).toBe(false);
    });

    it('adminHomeGuard should redirect to /admin/hrm', () => {
      const tree = TestBed.runInInjectionContext(() => adminHomeGuard({} as any, {} as any));
      expect(router.serializeUrl(tree as any)).toBe('/admin/hrm');
    });

    it('adminModuleGuard should allow hrm but block cms and redirect to /admin/khong-co-quyen', () => {
      const hrmRoute: Route = { data: { module: 'hrm' } };
      expect(TestBed.runInInjectionContext(() => adminModuleGuard(hrmRoute, []))).toBe(true);

      const cmsRoute: Route = { data: { module: 'cms' } };
      const tree = TestBed.runInInjectionContext(() => adminModuleGuard(cmsRoute, []));
      expect(router.serializeUrl(tree as any)).toBe('/admin/khong-co-quyen');
    });
  });

  describe('Case 3: User has [cms, crm]', () => {
    beforeEach(() => {
      session.user.set({
        id: 'u3',
        name: 'Marketing',
        email: 'mkt@fiin.vn',
        role: 'Nội dung & Khách hàng',
        modules: ['cms', 'crm'],
      });
    });

    it('should have cms and crm allowed', () => {
      const keys = session.allowedModules().map((m) => m.key);
      expect(keys).toEqual(['cms', 'crm']);
      expect(session.can('cms')).toBe(true);
      expect(session.can('crm')).toBe(true);
      expect(session.can('hrm')).toBe(false);
      expect(session.can('erp')).toBe(false);
    });

    it('adminHomeGuard should redirect to /admin/cms', () => {
      const tree = TestBed.runInInjectionContext(() => adminHomeGuard({} as any, {} as any));
      expect(router.serializeUrl(tree as any)).toBe('/admin/cms');
    });

    it('adminModuleGuard should allow cms, crm but block hrm, erp', () => {
      expect(TestBed.runInInjectionContext(() => adminModuleGuard({ data: { module: 'cms' } }, []))).toBe(true);
      expect(TestBed.runInInjectionContext(() => adminModuleGuard({ data: { module: 'crm' } }, []))).toBe(true);

      const hrmTree = TestBed.runInInjectionContext(() => adminModuleGuard({ data: { module: 'hrm' } }, []));
      expect(router.serializeUrl(hrmTree as any)).toBe('/admin/khong-co-quyen');

      const erpTree = TestBed.runInInjectionContext(() => adminModuleGuard({ data: { module: 'erp' } }, []));
      expect(router.serializeUrl(erpTree as any)).toBe('/admin/khong-co-quyen');
    });
  });

  describe('Case 4: User has no modules []', () => {
    beforeEach(() => {
      session.user.set({
        id: 'u4',
        name: 'Chưa cấp quyền',
        email: 'guest@fiin.vn',
        role: 'Khách',
        modules: [],
      });
    });

    it('should have empty allowedModules', () => {
      expect(session.allowedModules()).toEqual([]);
    });

    it('adminHomeGuard should redirect to /admin/khong-co-quyen', () => {
      const tree = TestBed.runInInjectionContext(() => adminHomeGuard({} as any, {} as any));
      expect(router.serializeUrl(tree as any)).toBe('/admin/khong-co-quyen');
    });

    it('adminModuleGuard should block all modules', () => {
      for (const mod of ['cms', 'crm', 'hrm', 'erp'] as const) {
        const tree = TestBed.runInInjectionContext(() => adminModuleGuard({ data: { module: mod } }, []));
        expect(router.serializeUrl(tree as any)).toBe('/admin/khong-co-quyen');
      }
    });
  });

  describe('Sign out & Unauthenticated checks', () => {
    it('signOut should clear user and navigate to /admin/login', () => {
      const navigateSpy = vi.spyOn(router, 'navigateByUrl');
      session.signOut();
      expect(session.user()).toBeNull();
      expect(navigateSpy).toHaveBeenCalledWith('/admin/login');
    });

    it('adminAuthGuard should redirect to /admin/login when user is null', () => {
      session.user.set(null);
      const tree = TestBed.runInInjectionContext(() => adminAuthGuard({} as any, {} as any));
      expect(router.serializeUrl(tree as any)).toBe('/admin/login');
    });

    it('adminGuestGuard should allow access to /admin/login when user is null', () => {
      session.user.set(null);
      const result = TestBed.runInInjectionContext(() => adminGuestGuard({} as any, {} as any));
      expect(result).toBe(true);
    });
  });

  describe('AdminAuthService (Mock HttpOnly Cookie flow)', () => {
    it('should authenticate valid demo credentials', async () => {
      const user = await new Promise((resolve, reject) => {
        authService.login('admin@fiin.vn', 'admin').subscribe({
          next: resolve,
          error: reject,
        });
      });
      expect(user).toBeTruthy();
      expect((user as any).email).toBe('admin@fiin.vn');
      expect((user as any).modules).toContain('hrm');
    });

    it('should fail with invalid credentials', async () => {
      await expect(
        new Promise((resolve, reject) => {
          authService.login('wrong@fiin.vn', 'wrongpass').subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow('Email hoặc mật khẩu không chính xác.');
    });
  });
});
