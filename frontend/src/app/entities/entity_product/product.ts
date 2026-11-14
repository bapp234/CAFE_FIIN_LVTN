export interface ProductItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  badge?: 'BÁN CHẠY!' | 'THỬ NGAY!' | 'MỚI';
  category: string;
  servingType: 'ice' | 'hot' | 'both';
  description: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
}

export const PRODUCT_CATEGORIES: CategoryItem[] = [
  { id: 'all', name: 'Tất Cả Thực Đơn', icon: '✦' },
  { id: 'ca-phe', name: 'Cà Phê Phin Truyền Thống', icon: '☕' },
  { id: 'tra', name: 'Trà & Trái Cây Tươi', icon: '🍵' },
  { id: 'phindi', name: 'PhinDi Thế Hệ Mới', icon: '✨' },
  { id: 'freeze', name: 'Freeze Đá Xay Béo Ngậy', icon: '🍧' },
  { id: 'banh-mi-que', name: 'Bánh Mì Que & Điểm Tâm', icon: '🥖' },
  { id: 'banh-ngot', name: 'Bánh Ngọt Thơm Bơ', icon: '🍰' },
  { id: 'luu-niem', name: 'Quà Lưu Niệm & Bình Giữ Nhiệt', icon: '🍶' },
];

export const MOCK_PRODUCTS: ProductItem[] = [
  // 1. CÀ PHÊ PHIN
  {
    id: 'p1',
    name: 'Phin Sữa Đá',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'ca-phe',
    servingType: 'ice',
    description: 'Cà phê phin truyền thống hòa quyện cùng sữa đặc béo ngọt sánh đậm.',
  },
  {
    id: 'p2',
    name: 'Phin Đen Đá',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'ca-phe',
    servingType: 'ice',
    description: 'Nguyên chất vị đắng mộc mạc của hạt Robusta & Arabica chọn lọc.',
  },
  {
    id: 'p3',
    name: 'Bạc Xỉu Đá Ba Tầng',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'THỬ NGAY!',
    category: 'ca-phe',
    servingType: 'ice',
    description: 'Nét tinh tế giao thoa giữa sữa tươi béo thơm và chút nốt đắng cà phê.',
  },
  {
    id: 'p4',
    name: 'Phin Sữa Nóng',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'ca-phe',
    servingType: 'hot',
    description: 'Ấm lòng buổi sớm mai Sài Gòn với ly phin sữa nóng hổi thơm nồng.',
  },
  {
    id: 'p5',
    name: 'Phin Đen Nóng',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'ca-phe',
    servingType: 'hot',
    description: 'Từng giọt cà phê đen nóng đậm đà, giữ trọn hương vị nguyên bản.',
  },
  {
    id: 'p6',
    name: 'Cà Phê Trứng Béo Ngậy',
    brand: 'CÀ PHÊ FIIN',
    price: 39000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'MỚI',
    category: 'ca-phe',
    servingType: 'hot',
    description: 'Lớp kem trứng đánh bông mịn màng hòa quyện dòng cà phê phin nóng.',
  },

  // 2. TRÀ & TRÁI CÂY
  {
    id: 't1',
    name: 'Trà Sen Vàng Hạt Sen',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'tra',
    servingType: 'both',
    description: 'Trà ô long thơm ngát kết hợp hạt sen bùi béo và củ năng giòn ngọt.',
  },
  {
    id: 't2',
    name: 'Trà Thạch Đào Mát Lạnh',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'tra',
    servingType: 'ice',
    description: 'Vị trà thanh mát hòa cùng miếng đào ngâm giòn ngọt và thạch đào dẻo dai.',
  },
  {
    id: 't3',
    name: 'Trà Thanh Đào Hương Nhài',
    brand: 'CÀ PHÊ FIIN',
    price: 42000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    category: 'tra',
    servingType: 'ice',
    description: 'Hương hoa nhài thoang thoảng cùng vị đào thanh khiết giải nhiệt tức thì.',
  },

  // 3. PHINDI
  {
    id: 'pd1',
    name: 'PhinDi Hạnh Nhân',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'phindi',
    servingType: 'ice',
    description: 'Cà phê phin thế hệ mới kết hợp sốt hạnh nhân thơm bùi hấp dẫn.',
  },
  {
    id: 'pd2',
    name: 'PhinDi Kem Sữa',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'phindi',
    servingType: 'ice',
    description: 'Lớp kem sữa béo ngậy phủ trên nền cà phê phin đậm đà thơm ngát.',
  },
  {
    id: 'pd3',
    name: 'PhinDi Choco Đậm Vị',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'phindi',
    servingType: 'ice',
    description: 'Sự hòa quyện tuyệt hảo giữa cacao nguyên chất và cà phê phin.',
  },

  // 4. FREEZE
  {
    id: 'fz1',
    name: 'Freeze Cà Phê Phin Béo',
    brand: 'CÀ PHÊ FIIN',
    price: 49000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    badge: 'THỬ NGAY!',
    category: 'freeze',
    servingType: 'ice',
    description: 'Đá xay mát lạnh từ cốt cà phê phin đậm đà cùng thạch cà phê dai giòn.',
  },
  {
    id: 'fz2',
    name: 'Freeze Trà Xanh Kem Bông',
    brand: 'CÀ PHÊ FIIN',
    price: 49000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'freeze',
    servingType: 'ice',
    description: 'Matcha Nhật Bản xay nhuyễn mát lạnh phủ lớp kem tươi bồng bềnh.',
  },

  // 5. BÁNH MÌ QUE & ĐIỂM TÂM
  {
    id: 'm1',
    name: 'Bánh Mì Que Chấm Sữa',
    brand: 'CÀ PHÊ FIIN',
    price: 14000,
    image: '/assets/images/newsletter/fiin-newsletter.png',
    badge: 'MỚI',
    category: 'banh-mi-que',
    servingType: 'both',
    description: 'Vỏ bánh mì que nướng giòn rụm chấm cùng sữa đặc béo ngậy tuổi thơ.',
  },
  {
    id: 'm2',
    name: 'Bánh Mì Que Chấm Cà Phê',
    brand: 'CÀ PHÊ FIIN',
    price: 38000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    category: 'banh-mi-que',
    servingType: 'both',
    description: 'Combo bánh mì que giòn nóng chấm cùng ly cà phê phin đậm nốt xưa.',
  },
  {
    id: 'm3',
    name: 'Bánh Mì Que Pate Cay Hải Phòng',
    brand: 'CÀ PHÊ FIIN',
    price: 19000,
    image: '/assets/images/newsletter/fiin-newsletter.png',
    badge: 'BÁN CHẠY!',
    category: 'banh-mi-que',
    servingType: 'both',
    description: 'Nhân pate gan béo ngậy thơm nức mũi cùng tương ớt cay nồng đậm vị.',
  },

  // 6. BÁNH NGỌT
  {
    id: 'b1',
    name: 'Bánh Mousse Cacao Đậm Vị',
    brand: 'CÀ PHÊ FIIN',
    price: 35000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'banh-ngot',
    servingType: 'both',
    description: 'Mousse cacao mềm mịn tan ngay trên đầu lưỡi, độ ngọt vừa phải.',
  },
  {
    id: 'b2',
    name: 'Bánh Phô Mai Chanh Dây',
    brand: 'CÀ PHÊ FIIN',
    price: 35000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'banh-ngot',
    servingType: 'both',
    description: 'Vị chua thanh mát của chanh dây hòa quyện lớp phô mai béo ngậy.',
  },

  // 7. LƯU NIỆM & BÌNH GIỮ NHIỆT
  {
    id: 'ln1',
    name: 'Phin Nhôm Cà Phê Fiin Xưa',
    brand: 'CÀ PHÊ FIIN',
    price: 55000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'MỚI',
    category: 'luu-niem',
    servingType: 'both',
    description: 'Phin nhôm dập hoa văn cổ điển, lỗ thoát li ti cho dòng phin chuẩn vị.',
  },
  {
    id: 'ln2',
    name: 'Bình Giữ Nhiệt Fiin Sài Gòn 500ml',
    brand: 'CÀ PHÊ FIIN',
    price: 185000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'luu-niem',
    servingType: 'both',
    description: 'Inox 304 giữ nhiệt 12 giờ, thiết kế retro mộc mạc tiện lợi mang theo.',
  },
];

