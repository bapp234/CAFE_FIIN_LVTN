export interface ProductItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: 'BÁN CHẠY!' | 'THỬ NGAY!' | 'MỚI' | 'GIÁ MỚI' | '-50%' | string;
  category: string;
  servingType: 'ice' | 'hot' | 'both';
  description: string;
  sku?: string;
  inStock?: boolean;
  galleryImages?: string[];
  detailedDescription?: string;
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
    sku: 'PVN01',
    inStock: true,
    galleryImages: [
      '/assets/images/hero/slide-01-desktop.webp',
      '/assets/images/hero/slide-02-desktop.webp',
    ],
    description: 'Cà phê phin truyền thống hòa quyện cùng sữa đặc béo ngọt sánh đậm.',
    detailedDescription: 'Hương vị cà phê phin truyền thống hòa quyện cùng sữa đặc sánh ngọt. Từng giọt cà phê chắt lọc tinh túy từ hạt Robusta Đắk Lắk được rang cẩn thận, mang đến ly cà phê đậm đà khó quên.',
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
    sku: 'PVN31',
    inStock: true,
    galleryImages: [
      '/assets/images/hero/slide-02-desktop.webp',
      '/assets/images/hero/slide-03-desktop.webp',
    ],
    description: 'Nguyên chất vị đắng mộc mạc của hạt Robusta & Arabica chọn lọc.',
    detailedDescription: 'Phin Đen Đá dành cho những tín đồ cà phê đích thực! Hương vị cà phê truyền thống được phối trộn độc đáo tại Cà Phê Fiin. Cà phê đậm đà pha từ Phin, cho thêm 1 thìa đường, mang đến vị cà phê đậm đà chất Phin. Đặt Cà Phê Fiin giao ngay.',
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
    sku: 'PVN03',
    inStock: true,
    galleryImages: [
      '/assets/images/hero/slide-03-desktop.webp',
      '/assets/images/hero/slide-01-desktop.webp',
    ],
    description: 'Nét tinh tế giao thoa giữa sữa tươi béo thơm và chút nốt đắng cà phê.',
    detailedDescription: 'Bạc Xỉu Đá là thức uống giao thoa giữa hương vị sữa tươi béo ngậy, sữa đặc ngọt dịu và một chút nốt đắng thanh tao của cà phê phin. Thức uống đặc trưng gắn liền với ký ức góc phố Sài Gòn xưa.',
  },
  {
    id: 'p4',
    name: 'Phin Sữa Nóng',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'ca-phe',
    servingType: 'hot',
    sku: 'PVN04',
    inStock: true,
    galleryImages: [
      '/assets/images/hero/slide-01-desktop.webp',
      '/assets/images/hero/slide-02-desktop.webp',
    ],
    description: 'Ấm lòng buổi sớm mai Sài Gòn với ly phin sữa nóng hổi thơm nồng.',
    detailedDescription: 'Ấm lòng mỗi sớm mai với ly cà phê phin sữa nóng tỏa khói nghi ngút, đánh thức trọn vẹn mọi giác quan với hương thơm nồng nàn.',
  },
  {
    id: 'p5',
    name: 'Phin Đen Nóng',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'ca-phe',
    servingType: 'hot',
    sku: 'PVN05',
    inStock: true,
    galleryImages: [
      '/assets/images/hero/slide-02-desktop.webp',
      '/assets/images/hero/slide-03-desktop.webp',
    ],
    description: 'Từng giọt cà phê đen nóng đậm đà, giữ trọn hương vị nguyên bản.',
    detailedDescription: 'Dành cho gu thưởng thức mộc mạc nhất: từng giọt cà phê đen nóng rơi chậm rãi, vị đắng sâu lắng cùng hậu vị ngọt thanh tự nhiên.',
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
    sku: 'PVN06',
    inStock: true,
    galleryImages: [
      '/assets/images/hero/slide-03-desktop.webp',
      '/assets/images/hero/slide-01-desktop.webp',
    ],
    description: 'Lớp kem trứng đánh bông mịn màng hòa quyện dòng cà phê phin nóng.',
    detailedDescription: 'Lớp kem trứng tươi đánh bông mịn béo ngậy được rót khéo léo lên nền cà phê phin nóng đậm đà, tạo nên trải nghiệm ngọt ngào khó quên.',
  },
  {
    id: 'p7',
    name: 'Espresso Nóng',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'ca-phe',
    servingType: 'hot',
    sku: 'PVN07',
    inStock: true,
    description: 'Chiết xuất đậm đà với lớp crema hạt dẻ sóng sánh.',
    detailedDescription: 'Ly Espresso ngắn gọn nhưng đậm đặc hương thơm quyến rũ từ hạt Arabica Cầu Đất rang mộc.',
  },
  {
    id: 'p8',
    name: 'Latte Nóng Thơm Dịu',
    brand: 'CÀ PHÊ FIIN',
    price: 55000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    badge: 'GIÁ MỚI',
    category: 'ca-phe',
    servingType: 'hot',
    sku: 'PVN08',
    inStock: true,
    description: 'Sự hòa quyện êm dịu giữa sữa tươi hấp nóng và espresso.',
    detailedDescription: 'Latte thơm lừng béo ngậy với lớp bọt sữa vẽ nghệ thuật, êm dịu dễ uống cho cả ngày dài.',
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
    sku: 'TR01',
    inStock: true,
    description: 'Trà ô long thơm ngát kết hợp hạt sen bùi béo và củ năng giòn ngọt.',
    detailedDescription: 'Trà sen vàng danh tiếng kết hợp trà ô long thanh khiết, hạt sen ninh nhừ bùi béo và củ năng giòn ngọt ngào mát lành.',
  },
  {
    id: 't2',
    name: 'Trà Thạch Đào Mát Lạnh',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'tra',
    servingType: 'ice',
    sku: 'TR02',
    inStock: true,
    description: 'Vị trà thanh mát hòa cùng miếng đào ngâm giòn ngọt và thạch đào dẻo dai.',
    detailedDescription: 'Những lát đào giòn sần sật quyện trong nước trà đào thanh tao, xua tan ngay cái nắng nóng của phố thị.',
  },
  {
    id: 't3',
    name: 'Trà Thanh Đào Hương Nhài',
    brand: 'CÀ PHÊ FIIN',
    price: 42000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    category: 'tra',
    servingType: 'ice',
    sku: 'TR03',
    inStock: true,
    description: 'Hương hoa nhài thoang thoảng cùng vị đào thanh khiết giải nhiệt tức thì.',
    detailedDescription: 'Hương hoa nhài êm dịu thoang thoảng cùng vị đào tươi mọng, mang đến cảm giác thư thái bình yên.',
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
    sku: 'PD01',
    inStock: true,
    description: 'Cà phê phin thế hệ mới kết hợp sốt hạnh nhân thơm bùi hấp dẫn.',
    detailedDescription: 'PhinDi Hạnh Nhân bứt phá phong cách: cốt cà phê phin kết hợp sữa thơm và sốt hạnh nhân rang thơm lừng.',
  },
  {
    id: 'pd2',
    name: 'PhinDi Kem Sữa',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'phindi',
    servingType: 'ice',
    sku: 'PD02',
    inStock: true,
    description: 'Lớp kem sữa béo ngậy phủ trên nền cà phê phin đậm đà thơm ngát.',
    detailedDescription: 'Sự hòa quyện tuyệt vời giữa lớp kem sữa béo ngậy và hương cà phê phin đậm đà nguyên bản.',
  },
  {
    id: 'pd3',
    name: 'PhinDi Choco Đậm Vị',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'phindi',
    servingType: 'ice',
    sku: 'PD03',
    inStock: true,
    description: 'Sự hòa quyện tuyệt hảo giữa cacao nguyên chất và cà phê phin.',
    detailedDescription: 'Sô-cô-la nguyên chất hòa cùng cà phê phin bùi ngọt, món quà dành cho người yêu vị ngọt ngào quyến rũ.',
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
    sku: 'FZ01',
    inStock: true,
    description: 'Đá xay mát lạnh từ cốt cà phê phin đậm đà cùng thạch cà phê dai giòn.',
    detailedDescription: 'Đá xay mát rượi từ cốt cà phê phin sánh mịn kết hợp thạch cà phê giòn dai vui miệng và lớp kem bông béo mịn.',
  },
  {
    id: 'fz2',
    name: 'Freeze Trà Xanh Kem Bông',
    brand: 'CÀ PHÊ FIIN',
    price: 55000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'freeze',
    servingType: 'ice',
    sku: 'FZ02',
    inStock: true,
    description: 'Matcha Nhật Bản xay nhuyễn mát lạnh phủ lớp kem tươi bồng bềnh.',
    detailedDescription: 'Trà xanh thượng hạng xay mịn cùng đá mát lạnh, phủ ngọn kem tươi bồng bềnh và thạch trà xanh giòn thơm.',
  },

  // 5. BÁNH MÌ QUE & ĐIỂM TÂM (Cross-sell Pastries)
  {
    id: 'm1',
    name: 'Bánh Mì Que Gà Phô Mai',
    brand: 'CÀ PHÊ FIIN',
    price: 19000,
    image: '/assets/images/newsletter/fiin-newsletter.png',
    badge: 'BÁN CHẠY!',
    category: 'banh-mi-que',
    servingType: 'both',
    sku: 'BM01',
    inStock: true,
    description: 'Vỏ bánh mì giòn rụm nhân gà xé thơm lừng hòa quyện phô mai béo ngậy.',
    detailedDescription: 'Bánh mì que nướng nóng hổi giòn rụm, nhân thịt gà xé đậm vị cùng lớp sốt phô mai béo ngậy tan chảy.',
  },
  {
    id: 'm2',
    name: 'Bánh Mì Que Pate',
    brand: 'CÀ PHÊ FIIN',
    price: 19000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'banh-mi-que',
    servingType: 'both',
    sku: 'BM02',
    inStock: true,
    description: 'Nhân pate gan truyền thống béo ngậy cùng vị cay the Hải Phòng.',
    detailedDescription: 'Bánh mì que pate truyền thống với lớp pate gan béo bùi, thơm nức mùi tiêu và chút tương ớt cay nồng đậm chất.',
  },
  {
    id: 'm3',
    name: 'Bánh Mì Que Chấm Sữa',
    brand: 'CÀ PHÊ FIIN',
    price: 14000,
    image: '/assets/images/newsletter/fiin-newsletter.png',
    badge: 'MỚI',
    category: 'banh-mi-que',
    servingType: 'both',
    sku: 'BM03',
    inStock: true,
    description: 'Vỏ bánh mì que nướng giòn rụm chấm cùng sữa đặc béo ngậy tuổi thơ.',
    detailedDescription: 'Kỷ niệm tuổi thơ ùa về với bánh mì que giòn nóng chấm sữa đặc Ông Thọ sánh mịn ngọt ngào.',
  },

  // 6. BÁNH NGỌT (Pastries)
  {
    id: 'b1',
    name: 'Bánh Phô Mai Trà Xanh',
    brand: 'CÀ PHÊ FIIN',
    price: 35000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'banh-ngot',
    servingType: 'both',
    sku: 'BN01',
    inStock: true,
    description: 'Cheesecake trà xanh mịn mượt thanh tao kết hợp đế bánh quy giòn.',
    detailedDescription: 'Lớp phô mai béo mềm kết hợp cùng bột trà xanh nguyên chất mang đến vị ngọt thanh tao, thơm dịu.',
  },
  {
    id: 'b2',
    name: 'Bánh Croissant Bơ Tỏi',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'banh-ngot',
    servingType: 'both',
    sku: 'BN02',
    inStock: true,
    description: 'Bánh sừng bò ngàn lớp thơm lừng bơ Pháp giòn rụm.',
    detailedDescription: 'Bánh sừng bò nướng vàng ươm với hàng trăm lớp bột xốp giòn rụm, thơm nức hương bơ tự nhiên hảo hạng.',
  },
  {
    id: 'b3',
    name: 'Bánh Chuối Nướng Mật Ong',
    brand: 'CÀ PHÊ FIIN',
    price: 29000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'BÁN CHẠY!',
    category: 'banh-ngot',
    servingType: 'both',
    sku: 'BN03',
    inStock: true,
    description: 'Bánh chuối nướng dẻo ngọt tự nhiên, thơm nốt bơ dừa ấm cúng.',
    detailedDescription: 'Bánh chuối nướng truyền thống với những lát chuối chín ngọt lịm tẩm mật ong, nướng thơm lừng.',
  },
  {
    id: 'b4',
    name: 'Bánh Kem Tiramisu',
    brand: 'CÀ PHÊ FIIN',
    price: 45000,
    image: '/assets/images/hero/slide-02-desktop.webp',
    category: 'banh-ngot',
    servingType: 'both',
    sku: 'BN04',
    inStock: true,
    description: 'Bánh tiramisu Ý chuẩn vị với cốt bánh thấm đẫm cà phê phin Fiin.',
    detailedDescription: 'Tiramisu trứ danh hòa quyện lớp kem mascarpone béo mịn và bánh sampa tẩm cà phê phin đậm đà thơm ngát.',
  },

  // 7. LƯU NIỆM & BÌNH GIỮ NHIỆT
  {
    id: 'ln1',
    name: 'Ly Nhựa Lily Jelly 500ml',
    brand: 'CÀ PHÊ FIIN',
    price: 137500,
    originalPrice: 275000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    badge: '-50%',
    category: 'luu-niem',
    servingType: 'both',
    sku: 'LN01',
    inStock: true,
    description: 'Ly nhựa 2 lớp cách nhiệt màu hồng pastel xinh xắn kèm ống hút tiện lợi.',
    detailedDescription: 'Ly giữ lạnh hai lớp Lily Jelly thiết kế thời trang, giữ đá tan chậm, phù hợp cho dân văn phòng và sinh viên.',
  },
  {
    id: 'ln2',
    name: 'Phin Nhôm Cà Phê Fiin Xưa',
    brand: 'CÀ PHÊ FIIN',
    price: 55000,
    image: '/assets/images/hero/slide-03-desktop.webp',
    badge: 'MỚI',
    category: 'luu-niem',
    servingType: 'both',
    sku: 'LN02',
    inStock: true,
    description: 'Phin nhôm dập hoa văn cổ điển, lỗ thoát li ti cho dòng phin chuẩn vị.',
    detailedDescription: 'Phin nhôm truyền thống dập hoa văn cổ điển, độ dày tiêu chuẩn giúp giữ nhiệt tối ưu cho giọt cà phê chiết xuất trọn vẹn.',
  },
  {
    id: 'ln3',
    name: 'Bình Giữ Nhiệt Fiin Sài Gòn 500ml',
    brand: 'CÀ PHÊ FIIN',
    price: 185000,
    image: '/assets/images/hero/slide-01-desktop.webp',
    category: 'luu-niem',
    servingType: 'both',
    sku: 'LN03',
    inStock: true,
    description: 'Inox 304 giữ nhiệt 12 giờ, thiết kế retro mộc mạc tiện lợi mang theo.',
    detailedDescription: 'Bình giữ nhiệt Inox 304 hai lớp chân không giữ nóng 8 giờ và giữ lạnh 12 giờ bền bỉ.',
  },
];

export function getProductById(id: string): ProductItem | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}

export function getRelatedProducts(currentId: string, category: string, limit = 5): ProductItem[] {
  const sameCategory = MOCK_PRODUCTS.filter(
    (p) => p.category === category && p.id !== currentId
  );
  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }
  const others = MOCK_PRODUCTS.filter(
    (p) => p.id !== currentId && p.category !== category
  );
  return [...sameCategory, ...others].slice(0, limit);
}

export function getPastryRecommendations(limit = 6): ProductItem[] {
  return MOCK_PRODUCTS.filter(
    (p) => p.category === 'banh-mi-que' || p.category === 'banh-ngot'
  ).slice(0, limit);
}

export function getRecentlyViewedFallback(currentId: string, limit = 4): ProductItem[] {
  const defaults = ['ln1', 'fz2', 'p1', 't1'];
  return defaults
    .filter((id) => id !== currentId)
    .map((id) => getProductById(id))
    .filter((p): p is ProductItem => !!p)
    .slice(0, limit);
}
