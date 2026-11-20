USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Cập nhật / khởi tạo mật khẩu dùng chung cho khóa & mở khóa HRM (chỉ quản lý tại database)
MERGE dbo.HrmSettings AS target
USING (SELECT 'ATTENDANCE_UNLOCK_PASSWORD' AS SettingKey) AS source
ON target.SettingKey = source.SettingKey
WHEN MATCHED THEN
    UPDATE SET
        SettingValue = N'OpenLock@fiin',
        Description  = N'Mật khẩu dùng chung để khóa/mở khóa HRM (chỉ cấu hình tại database)',
        UpdatedAt    = SYSDATETIME(),
        UpdatedBy    = 'DB_Admin'
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, Description, UpdatedAt, UpdatedBy)
    VALUES (
        'ATTENDANCE_UNLOCK_PASSWORD',
        N'OpenLock@fiin',
        N'Mật khẩu dùng chung để khóa/mở khóa HRM (chỉ cấu hình tại database)',
        SYSDATETIME(),
        'DB_Admin'
    );
GO

PRINT N'-> Đã thiết lập mật khẩu khóa/mở khóa HRM trong dbo.HrmSettings.';
GO
