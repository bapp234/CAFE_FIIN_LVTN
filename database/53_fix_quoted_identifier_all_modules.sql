USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- TỰ ĐỘNG BIÊN DỊCH LẠI TẤT CẢ STORED PROCEDURE / FUNCTION / TRIGGER / VIEW
-- ĐANG BỊ LƯU VỚI QUOTED_IDENTIFIER = OFF (GÂY LỖI SQL ERROR 1934)
-- =======================================================================================
DECLARE @ObjName NVARCHAR(300);
DECLARE @ObjType VARCHAR(60);
DECLARE @Def     NVARCHAR(MAX);
DECLARE @AlterSql NVARCHAR(MAX);
DECLARE @FixedCount INT = 0;
DECLARE @FailCount  INT = 0;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
SELECT
    OBJECT_SCHEMA_NAME(m.object_id) + '.' + OBJECT_NAME(m.object_id) AS ObjName,
    o.type_desc,
    m.definition
FROM sys.sql_modules m
JOIN sys.objects o ON m.object_id = o.object_id
WHERE m.uses_quoted_identifier = 0
  AND o.type IN ('P', 'FN', 'IF', 'TF', 'TR', 'V')
ORDER BY
    CASE o.type
        WHEN 'FN' THEN 1
        WHEN 'IF' THEN 2
        WHEN 'TF' THEN 3
        WHEN 'V'  THEN 4
        WHEN 'P'  THEN 5
        WHEN 'TR' THEN 6
        ELSE 7
    END,
    ObjName;

OPEN cur;
FETCH NEXT FROM cur INTO @ObjName, @ObjType, @Def;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @AlterSql = @Def;

    -- Chuyển CREATE [OR ALTER] <TYPE> thành ALTER <TYPE> để giữ nguyên quyền/phụ thuộc
    IF @AlterSql LIKE '%CREATE%OR%ALTER%PROCEDURE%' OR @AlterSql LIKE '%CREATE%OR%ALTER%PROC %'
        SET @AlterSql = STUFF(@AlterSql, PATINDEX('%CREATE%', @AlterSql), 6, 'CREATE');
    ELSE IF @ObjType = 'SQL_STORED_PROCEDURE' AND PATINDEX('%CREATE%PROC%', @AlterSql) > 0
        SET @AlterSql = STUFF(@AlterSql, PATINDEX('%CREATE%PROC%', @AlterSql), 6, 'ALTER');
    ELSE IF @ObjType IN ('SQL_SCALAR_FUNCTION', 'SQL_INLINE_TABLE_VALUED_FUNCTION', 'SQL_TABLE_VALUED_FUNCTION') AND PATINDEX('%CREATE%FUNCTION%', @AlterSql) > 0
        SET @AlterSql = STUFF(@AlterSql, PATINDEX('%CREATE%FUNCTION%', @AlterSql), 6, 'ALTER');
    ELSE IF @ObjType = 'SQL_TRIGGER' AND PATINDEX('%CREATE%TRIGGER%', @AlterSql) > 0
        SET @AlterSql = STUFF(@AlterSql, PATINDEX('%CREATE%TRIGGER%', @AlterSql), 6, 'ALTER');
    ELSE IF @ObjType = 'VIEW' AND PATINDEX('%CREATE%VIEW%', @AlterSql) > 0
        SET @AlterSql = STUFF(@AlterSql, PATINDEX('%CREATE%VIEW%', @AlterSql), 6, 'ALTER');

    BEGIN TRY
        EXEC sp_executesql @AlterSql;
        SET @FixedCount += 1;
    END TRY
    BEGIN CATCH
        SET @FailCount += 1;
        PRINT N'[WARN] Không thể tự động ALTER ' + @ObjName + N': ' + ERROR_MESSAGE();
    END CATCH;

    FETCH NEXT FROM cur INTO @ObjName, @ObjType, @Def;
END;

CLOSE cur;
DEALLOCATE cur;

PRINT N'-> Đã cập nhật QUOTED_IDENTIFIER ON cho ' + CAST(@FixedCount AS NVARCHAR(20)) + N' đối tượng (lỗi: ' + CAST(@FailCount AS NVARCHAR(20)) + N').';
GO
