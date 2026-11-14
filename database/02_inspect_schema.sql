-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ
-- Kịch bản kiểm tra toàn bộ Cấu trúc Bảng, Cột, Kiểu dữ liệu & Khóa (Schema Inspector)
-- File: src/database/02_inspect_schema.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

-- 1. TRUY VẤN TOÀN BỘ CẤU TRÚC 20 BẢNG (ĐẦY ĐỦ THUỘC TÍNH, KIỂU DỮ LIỆU, PK/FK, DEFAULT)
SELECT 
    t.name AS [TableName],
    c.column_id AS [Col#],
    c.name AS [ColumnName],
    CASE 
        WHEN ty.name IN ('varchar', 'char') THEN ty.name + '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR) END + ')'
        WHEN ty.name IN ('nvarchar', 'nchar') THEN ty.name + '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length / 2 AS VARCHAR) END + ')'
        WHEN ty.name IN ('decimal', 'numeric') THEN ty.name + '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
        WHEN ty.name IN ('datetime2', 'time') THEN ty.name + '(' + CAST(c.scale AS VARCHAR) + ')'
        ELSE ty.name
    END AS [DataType],
    CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS [Nullable],
    CASE WHEN pk.column_id IS NOT NULL AND fk.parent_column_id IS NOT NULL THEN 'PK, FK'
         WHEN pk.column_id IS NOT NULL THEN 'PK'
         WHEN fk.parent_column_id IS NOT NULL THEN 'FK'
         ELSE ''
    END AS [KeyType],
    ISNULL(OBJECT_NAME(fk.referenced_object_id) + '(' + COL_NAME(fk.referenced_object_id, fk.referenced_column_id) + ')', '') AS [FK_References],
    ISNULL(OBJECT_DEFINITION(c.default_object_id), '') AS [DefaultValue],
    CASE WHEN c.is_identity = 1 THEN 'YES' ELSE 'NO' END AS [IsIdentity]
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN (
    SELECT ic.object_id, ic.column_id
    FROM sys.index_columns ic
    INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    WHERE i.is_primary_key = 1
) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
LEFT JOIN sys.foreign_key_columns fk ON c.object_id = fk.parent_object_id AND c.column_id = fk.parent_column_id
ORDER BY t.name ASC, c.column_id ASC;
GO
