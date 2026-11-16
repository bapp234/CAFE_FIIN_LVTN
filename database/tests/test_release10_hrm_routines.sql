-- =======================================================================================
-- KIỂM THỬ XÁC MINH CÁC ROUTINES VÀ TRIGGERS RELEASE 10 (HRM)
-- Database: CoffeeShopDB
-- File: src/database/tests/test_release10_hrm_routines.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 1: sp_HRM_GetDailyAttendanceMonitor - Load danh sách chấm công ngày & KPI';
PRINT N'---------------------------------------------------------------------------------------';
-- Lấy dữ liệu ngày 2026-11-15 (hoặc ngày có dữ liệu)
EXEC dbo.sp_HRM_GetDailyAttendanceMonitor 
    @WorkDate = '2026-11-15', 
    @BranchId = 1, 
    @Status = 'all', 
    @Search = NULL, 
    @CurrentUsername = 'tunglt';
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 2: sp_HRM_ExportAttendanceReport - Xuất báo cáo chấm công theo khoảng ngày';
PRINT N'---------------------------------------------------------------------------------------';
EXEC dbo.sp_HRM_ExportAttendanceReport 
    @FromDate = '2026-11-01', 
    @ToDate = '2026-11-30', 
    @BranchId = 1, 
    @CurrentUsername = 'tunglt';
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 3: sp_HRM_UpsertShiftTemplate - Thêm ca mẫu mới và cập nhật';
PRINT N'---------------------------------------------------------------------------------------';
DECLARE @NewTemplateId INT;

-- Thêm ca gãy cao điểm
EXEC dbo.sp_HRM_UpsertShiftTemplate
    @TemplateId = @NewTemplateId OUTPUT,
    @ShiftCode = 'CA-CAO-DIEM',
    @ShiftName = N'Ca Cao Điểm Trưa & Tối',
    @StartTime = '11:00',
    @EndTime = '15:30',
    @BreakMinutes = 30,
    @ColorCode = 'amber',
    @IsActive = 1;

PRINT N'-> ID Ca mẫu mới tạo: ' + CAST(@NewTemplateId AS NVARCHAR(10));

-- Kiểm tra ca mẫu vừa tạo
SELECT TemplateId, ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode 
FROM dbo.ShiftTemplates 
WHERE TemplateId = @NewTemplateId;
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 4: sp_HRM_ExportWeeklySchedule - Xuất ma trận ca tuần (Thứ 2 -> CN)';
PRINT N'---------------------------------------------------------------------------------------';
EXEC dbo.sp_HRM_ExportWeeklySchedule 
    @BranchId = 1, 
    @StartDate = '2026-11-09', 
    @EndDate = '2026-11-15', 
    @CurrentUsername = 'tunglt';
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 5: sp_HRM_CalculatePayroll & sp_HRM_GetPayrollPeriodDetails - Tính lương & Load bảng lương';
PRINT N'---------------------------------------------------------------------------------------';
DECLARE @PeriodId INT;

EXEC dbo.sp_HRM_CalculatePayroll 
    @PeriodMonth = '2026-11', 
    @BranchId = 1, 
    @CalculatedBy = N'Admin tunglt', 
    @PeriodId = @PeriodId OUTPUT;

PRINT N'-> Đã tính toán kỳ lương thành công. PeriodId: ' + CAST(@PeriodId AS NVARCHAR(10));

-- Load chi tiết bảng lương vừa tính
EXEC dbo.sp_HRM_GetPayrollPeriodDetails 
    @PeriodMonth = '2026-11', 
    @BranchId = 1, 
    @CurrentUsername = 'tunglt';
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 6: sp_HRM_UpdateEmployeeProfile - Cập nhật hồ sơ nhân sự';
PRINT N'---------------------------------------------------------------------------------------';
-- Cập nhật thông tin cho NV002 (Nguyễn Thị Hương)
EXEC dbo.sp_HRM_UpdateEmployeeProfile
    @EmployeeId = 2,
    @FullName = N'Nguyễn Thị Hương (Lead Barista)',
    @PhoneNumber = '0902 888 999',
    @BankName = N'Vietcombank',
    @BankAccountNumber = '9876543210',
    @BankAccountName = N'NGUYEN THI HUONG',
    @HourlyRate = 32000,
    @Note = N'Được thăng cấp phụ trách kỹ thuật pha chế chuyên sâu.',
    @UpdatedByUsername = 'tunglt';

-- Xác minh dữ liệu đã đồng bộ sang cả Employees và Users
SELECT e.EmployeeId, e.EmployeeCode, u.FullName, u.PhoneNumber, e.BankName, e.BankAccountNumber, e.HourlyRate, e.Note, e.UpdatedAt
FROM dbo.Employees e
INNER JOIN dbo.Users u ON e.UserId = u.UserId
WHERE e.EmployeeId = 2;
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 7: sp_HRM_AssignApprovalAuthority - Trao cấp duyệt Cấp 3 cho NV001';
PRINT N'---------------------------------------------------------------------------------------';
-- Admin (tunglt - Cấp 5) nâng quyền duyệt cho NV001 (Đặng Quốc Anh) lên Cấp 3 (StoreManager)
EXEC dbo.sp_HRM_AssignApprovalAuthority
    @EmployeeId = 1,
    @ApprovalLevel = 3,
    @BranchId = 1,
    @ParentApproverEmployeeId = 3, -- Quản lý trực tiếp là Lê Thanh Tùng (NV003)
    @WorkflowCode = NULL, -- Toàn bộ quy trình cửa hàng
    @GrantedByUsername = 'tunglt',
    @Note = N'Phê duyệt nâng quyền Cửa hàng trưởng chi nhánh Đinh Tiên Hoàng';

-- Xác minh dữ liệu trong bảng Approvers và UserRoles
SELECT a.ApproverId, a.EmployeeId, e.EmployeeCode, u.Username, a.ApprovalLevel, a.BranchId, a.ParentApproverId, r.RoleName, a.AssignedDate, a.Note
FROM dbo.Approvers a
INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
INNER JOIN dbo.Users u ON e.UserId = u.UserId
LEFT JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
LEFT JOIN dbo.Roles r ON ur.RoleId = r.RoleId
WHERE e.EmployeeId = 1;
GO

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'TEST 8: Kiểm thử Trigger trg_ShiftAssignments_PreventOverlap - Chống trùng ca';
PRINT N'---------------------------------------------------------------------------------------';
BEGIN TRY
    -- Thử xếp thêm ca sáng 06:30 - 12:00 cho NV001 vào cùng ngày đã có ca
    INSERT INTO dbo.ShiftAssignments (EmployeeId, TemplateId, BranchId, WorkDate, RegisteredBy, Status, CreatedAt)
    VALUES (1, 1, 1, '2026-11-15', 'manager', 'scheduled', SYSDATETIME());
    PRINT N'CẢNH BÁO: Trigger không chặn xếp ca trùng!';
END TRY
BEGIN CATCH
    PRINT N'-> THÀNH CÔNG: Trigger đã phát hiện và chặn xếp trùng ca. Lỗi bắt được: ' + ERROR_MESSAGE();
END CATCH;
GO
