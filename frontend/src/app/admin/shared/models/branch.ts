export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export const MOCK_BRANCHES: readonly Branch[] = [
  {
    id: 'all',
    code: 'ALL',
    name: 'Toàn hệ thống',
    address: 'Áp dụng cho toàn bộ các chi nhánh',
    phone: '1900 6868',
    isActive: true,
  },
  {
    id: 'cn-q1',
    code: 'CN-Q1',
    name: 'Fiin Đinh Tiên Hoàng',
    address: '18 Đinh Tiên Hoàng, P. Đa Kao, Quận 1, TP.HCM',
    phone: '028 3822 1001',
    isActive: true,
  },
  {
    id: 'cn-q3',
    code: 'CN-Q3',
    name: 'Fiin Hồ Con Rùa',
    address: '42 Trần Cao Vân, P. Võ Thị Sáu, Quận 3, TP.HCM',
    phone: '028 3822 1002',
    isActive: true,
  },
  {
    id: 'cn-td',
    code: 'CN-THUDUC',
    name: 'Fiin Làng Đại Học',
    address: 'Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM',
    phone: '028 3822 1003',
    isActive: true,
  },
  {
    id: 'cn-bt',
    code: 'CN-BINHTHANH',
    name: 'Fiin Phan Xích Long',
    address: '68 Phan Xích Long, P. 2, Q. Bình Thạnh, TP.HCM',
    phone: '028 3822 1004',
    isActive: true,
  },
];
