import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ErpDashboardStats,
  InventoryItem,
  MonthlyRevenueReport,
  ProductCategoryRevenue,
  ProductMenuItem,
  PurchaseOrder,
  Supplier,
} from '../models/erp_models';

@Injectable({
  providedIn: 'root',
})
export class ErpApi {
  // 1. Dữ liệu kho nguyên vật liệu mẫu
  private inventoryItems: InventoryItem[] = [
    {
      id: 1,
      code: 'NVL001',
      name: 'Cà phê Robusta Mộc (Buôn Ma Thuột)',
      category: 'coffee',
      categoryName: 'Cà phê hạt',
      unit: 'Kg',
      currentStock: 45.5,
      minStock: 20,
      costPrice: 185000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'in_stock',
      lastImportDate: '15/11/2026',
    },
    {
      id: 2,
      code: 'NVL002',
      name: 'Cà phê Arabica Cầu Đất (Rang vừa)',
      category: 'coffee',
      categoryName: 'Cà phê hạt',
      unit: 'Kg',
      currentStock: 12.0,
      minStock: 15,
      costPrice: 280000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'low_stock',
      lastImportDate: '10/11/2026',
    },
    {
      id: 3,
      code: 'NVL003',
      name: 'Sữa tươi thanh trùng Dalat Milk (Không đường)',
      category: 'milk',
      categoryName: 'Sữa & Kem béo',
      unit: 'Lít',
      currentStock: 8.0,
      minStock: 15,
      costPrice: 38000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'low_stock',
      lastImportDate: '18/11/2026',
    },
    {
      id: 4,
      code: 'NVL004',
      name: 'Sữa đặc có đường Ngôi Sao Phương Nam (Lon 1.28kg)',
      category: 'milk',
      categoryName: 'Sữa & Kem béo',
      unit: 'Hộp',
      currentStock: 34,
      minStock: 10,
      costPrice: 62000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'in_stock',
      lastImportDate: '12/11/2026',
    },
    {
      id: 5,
      code: 'NVL005',
      name: 'Syrup Vani Davinci (Chai 750ml)',
      category: 'syrup',
      categoryName: 'Đường & Syrup',
      unit: 'Chai',
      currentStock: 0,
      minStock: 3,
      costPrice: 195000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'out_of_stock',
      lastImportDate: '01/11/2026',
    },
    {
      id: 6,
      code: 'NVL006',
      name: 'Trà Oolong Bảo Lộc (Hương sen)',
      category: 'syrup',
      categoryName: 'Trà mộc',
      unit: 'Kg',
      currentStock: 18.5,
      minStock: 8,
      costPrice: 240000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'in_stock',
      lastImportDate: '14/11/2026',
    },
    {
      id: 7,
      code: 'NVL007',
      name: 'Ly giấy Kraft 12oz Cà Phê Fiin (In logo)',
      category: 'packaging',
      categoryName: 'Bao bì & Vật tư',
      unit: 'Thùng (1000 cái)',
      currentStock: 2.0,
      minStock: 4,
      costPrice: 650000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'low_stock',
      lastImportDate: '05/11/2026',
    },
    {
      id: 8,
      code: 'NVL008',
      name: 'Ống hút bã mía tự hủy sinh học',
      category: 'packaging',
      categoryName: 'Bao bì & Vật tư',
      unit: 'Gói (500 cái)',
      currentStock: 15,
      minStock: 5,
      costPrice: 75000,
      branchName: 'Fiin Đinh Tiên Hoàng',
      status: 'in_stock',
      lastImportDate: '10/11/2026',
    },
  ];

  // 2. Dữ liệu nhà cung cấp mẫu
  private suppliers: Supplier[] = [
    {
      id: 1,
      code: 'NCC001',
      name: 'Công ty Cổ phần Nông sản Cầu Đất Farm',
      category: 'Cà phê hạt mộc cao cấp',
      contactPerson: 'Nguyễn Văn Hùng',
      phone: '0908 123 456',
      email: 'hang.caudat@farm.vn',
      address: 'Trạm Hành, TP. Đà Lạt, Lâm Đồng',
      currentDebt: 14500000,
      status: 'active',
    },
    {
      id: 2,
      code: 'NCC002',
      name: 'Chi nhánh Công ty Sữa Dalat Milk TP.HCM',
      category: 'Sữa tươi thanh trùng',
      contactPerson: 'Trần Thị Thu Thảo',
      phone: '0912 345 678',
      email: 'sales.hcm@dalatmilk.vn',
      address: '128 Nguyễn Thị Minh Khai, Q.3, TP.HCM',
      currentDebt: 5800000,
      status: 'active',
    },
    {
      id: 3,
      code: 'NCC003',
      name: 'Tổng kho Nguyên liệu Pha chế BaristaMart',
      category: 'Syrup, Sốt, Bột pha chế',
      contactPerson: 'Lê Hoàng Nam',
      phone: '0987 654 321',
      email: 'nam.le@baristamart.com',
      address: '45/2 Tân Cảng, P.25, Bình Thạnh, TP.HCM',
      currentDebt: 0,
      status: 'active',
    },
    {
      id: 4,
      code: 'NCC004',
      name: 'Bao Bì Xanh Việt Nam EcoPack',
      category: 'Ly giấy, Ống hút sinh học, Túi mang về',
      contactPerson: 'Phạm Minh Tú',
      phone: '0933 888 999',
      email: 'tu.minh@ecopack.vn',
      address: 'Lô B2 KCN Tân Bình, Tân Phú, TP.HCM',
      currentDebt: 8200000,
      status: 'active',
    },
  ];

  // 3. Dữ liệu đơn mua hàng (Purchase Orders)
  private purchaseOrders: PurchaseOrder[] = [
    {
      id: 1,
      poCode: 'PO-202611-001',
      orderDate: '15/11/2026',
      supplierId: 1,
      supplierName: 'Công ty Cổ phần Nông sản Cầu Đất Farm',
      branchName: 'Fiin Đinh Tiên Hoàng',
      itemCount: 2,
      totalAmount: 18500000,
      status: 'completed',
      expectedDelivery: '16/11/2026',
      note: 'Nhập hạt Robusta và Arabica tháng 11',
    },
    {
      id: 2,
      poCode: 'PO-202611-002',
      orderDate: '18/11/2026',
      supplierId: 2,
      supplierName: 'Chi nhánh Công ty Sữa Dalat Milk TP.HCM',
      branchName: 'Fiin Đinh Tiên Hoàng',
      itemCount: 1,
      totalAmount: 3800000,
      status: 'shipping',
      expectedDelivery: '19/11/2026',
      note: '100 lít sữa tươi thanh trùng',
    },
    {
      id: 3,
      poCode: 'PO-202611-003',
      orderDate: '19/11/2026',
      supplierId: 3,
      supplierName: 'Tổng kho Nguyên liệu Pha chế BaristaMart',
      branchName: 'Fiin Đinh Tiên Hoàng',
      itemCount: 4,
      totalAmount: 4650000,
      status: 'pending',
      expectedDelivery: '20/11/2026',
      note: 'Bổ sung Syrup Vani và Sốt Caramel hết hàng',
    },
    {
      id: 4,
      poCode: 'PO-202611-004',
      orderDate: '12/11/2026',
      supplierId: 4,
      supplierName: 'Bao Bì Xanh Việt Nam EcoPack',
      branchName: 'Fiin Đinh Tiên Hoàng',
      itemCount: 3,
      totalAmount: 7200000,
      status: 'completed',
      expectedDelivery: '13/11/2026',
      note: 'In thêm 5000 ly giấy Kraft 12oz',
    },
  ];

  // 4. Báo cáo doanh thu & chi phí 12 tháng
  private monthlyReports: MonthlyRevenueReport[] = [
    { month: 'T12/25', revenue: 380000000, cogs: 133000000, grossProfit: 247000000, orderCount: 5200 },
    { month: 'T01/26', revenue: 410000000, cogs: 143500000, grossProfit: 266500000, orderCount: 5600 },
    { month: 'T02/26', revenue: 450000000, cogs: 157500000, grossProfit: 292500000, orderCount: 6100 },
    { month: 'T03/26', revenue: 420000000, cogs: 147000000, grossProfit: 273000000, orderCount: 5800 },
    { month: 'T04/26', revenue: 460000000, cogs: 161000000, grossProfit: 299000000, orderCount: 6300 },
    { month: 'T05/26', revenue: 490000000, cogs: 171500000, grossProfit: 318500000, orderCount: 6700 },
    { month: 'T06/26', revenue: 530000000, cogs: 185500000, grossProfit: 344500000, orderCount: 7200 },
    { month: 'T07/26', revenue: 510000000, cogs: 178500000, grossProfit: 331500000, orderCount: 6900 },
    { month: 'T08/26', revenue: 540000000, cogs: 189000000, grossProfit: 351000000, orderCount: 7400 },
    { month: 'T09/26', revenue: 560000000, cogs: 196000000, grossProfit: 364000000, orderCount: 7700 },
    { month: 'T10/26', revenue: 580000000, cogs: 203000000, grossProfit: 377000000, orderCount: 7950 },
    { month: 'T11/26', revenue: 610000000, cogs: 213500000, grossProfit: 396500000, orderCount: 8400 },
  ];

  private categoryRevenues: ProductCategoryRevenue[] = [
    { categoryName: 'Cà phê pha máy Espresso', percentage: 42, revenue: 256200000, color: '#8c5b36' },
    { categoryName: 'Cà phê truyền thống Sài Gòn', percentage: 28, revenue: 170800000, color: '#634327' },
    { categoryName: 'Trà trái cây & Macchiato', percentage: 18, revenue: 109800000, color: '#059669' },
    { categoryName: 'Bánh tươi & Điểm tâm', percentage: 12, revenue: 73200000, color: '#d97706' },
  ];

  // 5. Dữ liệu thực đơn món & công thức định lượng (Recipe/BOM) trừ kho
  private menuProducts: ProductMenuItem[] = [
    {
      id: 1,
      code: 'MON001',
      name: 'Cà phê sữa đá Sài Gòn (Pha phin)',
      category: 'coffee_traditional',
      categoryName: 'Cà phê truyền thống',
      priceSizeS: 29000,
      priceSizeM: 35000,
      priceSizeL: 42000,
      status: 'active',
      description: 'Hương vị đậm đà truyền thống từ hạt Robusta Buôn Ma Thuột hòa quyện sữa đặc béo ngậy.',
      recipe: [
        { inventoryCode: 'NVL001', inventoryName: 'Robusta Mộc', quantity: 0.025, unit: 'Kg' },
        { inventoryCode: 'NVL004', inventoryName: 'Sữa đặc Ngôi Sao', quantity: 0.03, unit: 'Hộp' },
        { inventoryCode: 'NVL007', inventoryName: 'Ly giấy Kraft', quantity: 1, unit: 'Cái' },
        { inventoryCode: 'NVL008', inventoryName: 'Ống hút bã mía', quantity: 1, unit: 'Cái' },
      ],
    },
    {
      id: 2,
      code: 'MON002',
      name: 'Bạc xỉu Fiin Signature',
      category: 'coffee_traditional',
      categoryName: 'Cà phê truyền thống',
      priceSizeS: 32000,
      priceSizeM: 39000,
      priceSizeL: 46000,
      status: 'active',
      description: 'Nhiều sữa tươi thanh trùng, ít cà phê, lớp bọt sữa thơm mịn béo nhẹ thanh tao.',
      recipe: [
        { inventoryCode: 'NVL001', inventoryName: 'Robusta Mộc', quantity: 0.015, unit: 'Kg' },
        { inventoryCode: 'NVL003', inventoryName: 'Sữa tươi Dalat Milk', quantity: 0.08, unit: 'Lít' },
        { inventoryCode: 'NVL004', inventoryName: 'Sữa đặc Ngôi Sao', quantity: 0.02, unit: 'Hộp' },
        { inventoryCode: 'NVL007', inventoryName: 'Ly giấy Kraft', quantity: 1, unit: 'Cái' },
      ],
    },
    {
      id: 3,
      code: 'MON003',
      name: 'Caffe Latte Cầu Đất (Nóng / Đá)',
      category: 'coffee_espresso',
      categoryName: 'Cà phê pha máy',
      priceSizeS: 45000,
      priceSizeM: 52000,
      priceSizeL: 59000,
      status: 'active',
      description: 'Single shot Espresso Arabica Cầu Đất thơm hương hoa quả kết hợp sữa tươi đánh nóng nghệ thuật.',
      recipe: [
        { inventoryCode: 'NVL002', inventoryName: 'Arabica Cầu Đất', quantity: 0.018, unit: 'Kg' },
        { inventoryCode: 'NVL003', inventoryName: 'Sữa tươi Dalat Milk', quantity: 0.18, unit: 'Lít' },
        { inventoryCode: 'NVL007', inventoryName: 'Ly giấy Kraft', quantity: 1, unit: 'Cái' },
      ],
    },
    {
      id: 4,
      code: 'MON004',
      name: 'Americano Đá Arabica',
      category: 'coffee_espresso',
      categoryName: 'Cà phê pha máy',
      priceSizeS: 35000,
      priceSizeM: 42000,
      priceSizeL: 49000,
      status: 'active',
      description: 'Espresso nguyên chất pha loãng với nước lọc tinh khiết và đá lạnh, vị thanh chua nhẹ.',
      recipe: [
        { inventoryCode: 'NVL002', inventoryName: 'Arabica Cầu Đất', quantity: 0.02, unit: 'Kg' },
        { inventoryCode: 'NVL007', inventoryName: 'Ly giấy Kraft', quantity: 1, unit: 'Cái' },
      ],
    },
    {
      id: 5,
      code: 'MON005',
      name: 'Trà Oolong Sen Vàng Kem Macchiato',
      category: 'tea',
      categoryName: 'Trà & Macchiato',
      priceSizeS: 42000,
      priceSizeM: 48000,
      priceSizeL: 55000,
      status: 'active',
      description: 'Trà Oolong Bảo Lộc đậm đà kết hợp hạt sen sấy dẻo và lớp kem cheese mặn béo ngậy.',
      recipe: [
        { inventoryCode: 'NVL006', inventoryName: 'Trà Oolong Bảo Lộc', quantity: 0.015, unit: 'Kg' },
        { inventoryCode: 'NVL003', inventoryName: 'Sữa tươi Dalat Milk', quantity: 0.05, unit: 'Lít' },
        { inventoryCode: 'NVL007', inventoryName: 'Ly giấy Kraft', quantity: 1, unit: 'Cái' },
      ],
    },
    {
      id: 6,
      code: 'MON006',
      name: 'Bánh sừng bò Croissant bơ Pháp',
      category: 'bakery',
      categoryName: 'Bánh tươi & Snack',
      priceSizeS: 35000,
      priceSizeM: 35000,
      priceSizeL: 35000,
      status: 'active',
      description: 'Bánh nướng nóng giòn từng lớp, thơm lừng bơ Pháp cao cấp ăn kèm cà phê sáng.',
      recipe: [
        { inventoryCode: 'NVL007', inventoryName: 'Túi giấy Kraft đựng bánh', quantity: 1, unit: 'Cái' },
      ],
    },
  ];

  // API Methods
  getMenuItems(): Observable<ProductMenuItem[]> {
    return of(this.menuProducts);
  }
  getDashboardStats(): Observable<ErpDashboardStats> {
    const totalInventoryValue = this.inventoryItems.reduce(
      (sum, item) => sum + item.currentStock * item.costPrice,
      0
    );
    const lowStockCount = this.inventoryItems.filter((i) => i.status === 'low_stock').length;
    const outOfStockCount = this.inventoryItems.filter((i) => i.status === 'out_of_stock').length;
    const monthlyPurchaseTotal = this.purchaseOrders
      .filter((po) => po.status === 'completed' || po.status === 'shipping')
      .reduce((sum, po) => sum + po.totalAmount, 0);
    const pendingPoCount = this.purchaseOrders.filter((po) => po.status === 'pending').length;
    const totalSupplierDebt = this.suppliers.reduce((sum, s) => sum + s.currentDebt, 0);

    return of({
      totalInventoryValue,
      totalSkuCount: this.inventoryItems.length,
      lowStockCount,
      outOfStockCount,
      monthlyPurchaseTotal,
      pendingPoCount,
      totalSupplierDebt,
      monthlyGrossRevenue: 610000000,
    });
  }

  getInventoryItems(): Observable<InventoryItem[]> {
    return of(this.inventoryItems);
  }

  getSuppliers(): Observable<Supplier[]> {
    return of(this.suppliers);
  }

  getPurchaseOrders(): Observable<PurchaseOrder[]> {
    return of(this.purchaseOrders);
  }

  getMonthlyReports(): Observable<MonthlyRevenueReport[]> {
    return of(this.monthlyReports);
  }

  getCategoryRevenues(): Observable<ProductCategoryRevenue[]> {
    return of(this.categoryRevenues);
  }
}
