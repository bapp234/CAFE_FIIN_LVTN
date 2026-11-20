export interface InventoryItem {
  id: number;
  code: string;
  name: string;
  category: 'coffee' | 'milk' | 'syrup' | 'packaging' | 'other';
  categoryName: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: number;
  branchName: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  lastImportDate: string;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  currentDebt: number;
  status: 'active' | 'suspended';
}

export interface PurchaseOrder {
  id: number;
  poCode: string;
  orderDate: string;
  supplierId: number;
  supplierName: string;
  branchName: string;
  itemCount: number;
  totalAmount: number;
  status: 'pending' | 'shipping' | 'completed' | 'cancelled';
  expectedDelivery: string;
  note?: string;
}

export interface ErpDashboardStats {
  totalInventoryValue: number;
  totalSkuCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  monthlyPurchaseTotal: number;
  pendingPoCount: number;
  totalSupplierDebt: number;
  monthlyGrossRevenue: number;
}

export interface MonthlyRevenueReport {
  month: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  orderCount: number;
}

export interface ProductCategoryRevenue {
  categoryName: string;
  percentage: number;
  revenue: number;
  color: string;
}

export interface RecipeIngredient {
  inventoryCode: string;
  inventoryName: string;
  quantity: number;
  unit: string;
}

export interface ProductMenuItem {
  id: number;
  code: string;
  name: string;
  category: 'coffee_espresso' | 'coffee_traditional' | 'tea' | 'bakery';
  categoryName: string;
  priceSizeS: number;
  priceSizeM: number;
  priceSizeL: number;
  status: 'active' | 'out_of_stock' | 'inactive';
  recipe: RecipeIngredient[];
  imageUrl?: string;
  description?: string;
}
