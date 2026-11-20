-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ
-- Tiện ích trích xuất mã nguồn Stored Procedure, Function, View, Trigger đa năng
-- File: src/database/15_utility_get_sql_script_multi.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetSQLScript_Multi
    @ObjectNames  NVARCHAR(MAX) = '%',    -- Tên đối tượng, danh sách cách nhau bởi dấu phẩy, hoặc wildcard '%từ_khóa%'
    @ObjectType   VARCHAR(20)   = 'ALL',  -- 'ALL', 'P' (Procedure), 'FN' (Scalar Fn), 'TF'/'IF' (Table Fn), 'TR' (Trigger), 'V' (View)
    @PrintScript  BIT           = 0,      -- 1: In trực tiếp ra tab Messages (giữ nguyên 100% định dạng xuống dòng)
    @SplitLines   BIT           = 0       -- 1: Tách từng dòng code thành từng hàng trong Grid (để copy không bị dồn dòng)
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Chuẩn hóa tham số đầu vào
    IF @ObjectNames IS NULL OR LTRIM(RTRIM(@ObjectNames)) = ''
        SET @ObjectNames = '%';

    -- 2. Bảng tạm lưu danh sách mẫu tìm kiếm
    DECLARE @TargetPatterns TABLE (Pattern NVARCHAR(255));

    IF CHARINDEX(',', @ObjectNames) > 0
    BEGIN
        INSERT INTO @TargetPatterns (Pattern)
        SELECT LTRIM(RTRIM(value))
        FROM STRING_SPLIT(@ObjectNames, ',')
        WHERE LTRIM(RTRIM(value)) <> '';
    END
    ELSE
    BEGIN
        INSERT INTO @TargetPatterns (Pattern)
        VALUES (LTRIM(RTRIM(@ObjectNames)));
    END

    -- 3. Bảng tạm lưu kết quả truy vấn
    DECLARE @Results TABLE (
        RowId            INT IDENTITY(1,1) PRIMARY KEY,
        ObjectName       NVARCHAR(150),
        DateInfo         NVARCHAR(100),
        SQLScript        NVARCHAR(MAX)
    );

    INSERT INTO @Results (ObjectName, DateInfo, SQLScript)
    SELECT 
        o.name AS [ObjectName],
        N'Tạo: ' + CONVERT(VARCHAR(10), o.create_date, 120) + N' | Sửa: ' + CONVERT(VARCHAR(19), o.modify_date, 120) AS [DateInfo],
        m.definition AS [SQLScript]
    FROM sys.sql_modules m
    INNER JOIN sys.objects o ON m.object_id = o.object_id
    INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
    INNER JOIN @TargetPatterns t ON (
        o.name = t.Pattern
        OR s.name + '.' + o.name = t.Pattern
        OR (t.Pattern LIKE '%[%]%' AND o.name LIKE t.Pattern)
    )
    WHERE o.is_ms_shipped = 0
      AND (
          @ObjectType = 'ALL'
          OR (@ObjectType = 'P'  AND o.type = 'P')
          OR (@ObjectType = 'FN' AND o.type IN ('FN', 'FS', 'FT'))
          OR (@ObjectType = 'TF' AND o.type IN ('IF', 'TF'))
          OR (@ObjectType = 'TR' AND o.type = 'TR')
          OR (@ObjectType = 'V'  AND o.type = 'V')
          OR o.type = @ObjectType
      )
    ORDER BY o.name ASC;

    DECLARE @Count INT = (SELECT COUNT(*) FROM @Results);
    IF @Count = 0
    BEGIN
        PRINT N'Không tìm thấy đối tượng nào khớp với: [' + @ObjectNames + N']';
        RETURN;
    END

    -- =========================================================================
    -- TRƯỜNG HỢP 1: IN TRỰC TIẾP RA TAB MESSAGES (GIỮ NGUYÊN 100% XUỐNG DÒNG)
    -- =========================================================================
    IF @PrintScript = 1
    BEGIN
        DECLARE @CurrentRow INT = 1;
        DECLARE @ObjName NVARCHAR(150), @DateInfo NVARCHAR(100), @Code NVARCHAR(MAX);

        WHILE @CurrentRow <= @Count
        BEGIN
            SELECT @ObjName = ObjectName, @DateInfo = DateInfo, @Code = SQLScript
            FROM @Results WHERE RowId = @CurrentRow;

            PRINT N'-- =======================================================================================';
            PRINT N'-- TÊN ĐỐI TƯỢNG: ' + @ObjName;
            PRINT N'-- THỜI GIAN:     ' + @DateInfo;
            PRINT N'-- =======================================================================================';

            DECLARE @Pos INT = 1, @ChunkSize INT = 3800, @TotalLen INT = LEN(@Code);
            WHILE @Pos <= @TotalLen
            BEGIN
                PRINT SUBSTRING(@Code, @Pos, @ChunkSize);
                SET @Pos = @Pos + @ChunkSize;
            END

            PRINT NCHAR(10) + N'GO' + NCHAR(10);
            SET @CurrentRow = @CurrentRow + 1;
        END
        RETURN;
    END

    -- =========================================================================
    -- TRƯỜNG HỢP 2: TÁCH TỪNG DÒNG CODE VÀO BẢNG (COPY KHÔNG BỊ DỒN DÒNG)
    -- =========================================================================
    IF @SplitLines = 1
    BEGIN
        SELECT 
            r.ObjectName AS [Tên đối tượng],
            r.DateInfo AS [Ngày tạo / Sửa đổi],
            s.value AS [Mã nguồn]
        FROM @Results r
        CROSS APPLY STRING_SPLIT(REPLACE(r.SQLScript, CHAR(13), ''), CHAR(10)) s;
        RETURN;
    END

    -- =========================================================================
    -- TRƯỜNG HỢP 3: MẶC ĐỊNH (SỬ DỤNG [text()] ĐỂ BỎ HOÀN TOÀN THẺ <SQLScript>)
    -- Bấm vào link XML là ra mã nguồn thuần 100%, không dính bất kỳ thẻ XML nào!
    -- =========================================================================
    SELECT 
        r.ObjectName AS [Tên đối tượng],
        r.DateInfo AS [Ngày tạo / Sửa đổi],
        (SELECT r.SQLScript AS [text()] FOR XML PATH(''), TYPE) AS [Mã nguồn (Click mở tab mới copy chạy luôn)]
    FROM @Results r
    ORDER BY r.ObjectName ASC;
END;
GO

PRINT N'-> Đã nâng cấp thành công thủ tục: dbo.sp_GetSQLScript_Multi';
GO
