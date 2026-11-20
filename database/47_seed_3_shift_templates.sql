USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- KHỞI TẠO 3 CA LÀM VIỆC CHUẨN: CA SÁNG, CA CHIỀU, CA HÀNH CHÍNH
-- ============================================================================
MERGE INTO dbo.ShiftTemplates AS target
USING (
    VALUES
        ('CA-SANG',  N'Ca Sáng',       '06:30:00', '12:00:00', 0,  5.50, 'emerald', 1),
        ('CA-CHIEU', N'Ca Chiều',      '12:00:00', '17:30:00', 0,  5.50, 'amber',   1),
        ('CA-HC',    N'Ca Hành chính', '08:00:00', '17:00:00', 60, 8.00, 'blue',    1)
) AS src (ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive)
ON target.ShiftCode = src.ShiftCode
WHEN MATCHED THEN
    UPDATE SET
        ShiftName     = src.ShiftName,
        StartTime     = src.StartTime,
        EndTime       = src.EndTime,
        BreakMinutes  = src.BreakMinutes,
        StandardHours = src.StandardHours,
        ColorCode     = src.ColorCode,
        IsActive      = src.IsActive
WHEN NOT MATCHED THEN
    INSERT (ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive)
    VALUES (src.ShiftCode, src.ShiftName, src.StartTime, src.EndTime, src.BreakMinutes, src.StandardHours, src.ColorCode, src.IsActive);
GO
PRINT N'-> Đã tạo 3 ca làm việc: CA-SANG, CA-CHIEU, CA-HC.';
GO
