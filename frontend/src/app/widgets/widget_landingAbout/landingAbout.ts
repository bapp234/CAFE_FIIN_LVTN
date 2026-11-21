import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* =========================================================
   DỮ LIỆU CUỐN ALBUM
   Mỗi chương = 1 cặp trang: trang ảnh (trái) + trang chữ (phải).
   Muốn thêm/bớt năm chỉ cần thêm/bớt phần tử trong CHAPTERS.
   ========================================================= */
interface Photo {
  src: string;
  alt: string;
  caption: string;
  x: number; // % theo bề ngang trang
  y: number; // % theo chiều cao trang
  w: number; // % bề rộng ảnh
  r: number; // độ nghiêng
  ratio: string;
  depth: number; // độ "sâu" cho parallax
  z: number;
  arch: boolean;
  c1: string;
  c2: string;
}
interface Note {
  main: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  r: number;
  depth: number;
}
interface Fact {
  k: string;
  v: string;
}
interface Chapter {
  year: string;
  phase: string;
  tagName: string;
  titleWords: string[];
  textWords: string[];
  facts: Fact[];
  photos: Photo[];
  note: Note;
}
interface Leaf {
  index: number;
  text?: Chapter; // mặt trước (trang chữ)
  photos?: Chapter; // mặt sau (trang ảnh)
}
interface Bean {
  x: number;
  y: number;
  s: number;
  r: number;
  o: number;
  b: number;
  depth: number;
}

const IMG = '/assets/images/about/';
const words = (s: string): string[] => s.trim().split(/\s+/);

// Tông màu nền khi ảnh chưa có (placeholder)
const TONES: [string, string][] = [
  ['#7a4a2e', '#2a170d'],
  ['#3f5a45', '#18261c'],
  ['#a8704a', '#4a2813'],
  ['#6b6157', '#241d17'],
];
const tone = (i: number): [string, string] => TONES[i % TONES.length] as [string, string];

type Spec = [src: string, alt: string, caption: string];

/** Bố cục 2 ảnh + 1 ghi chú trên một trang. mirror = đảo trái/phải cho đỡ đơn điệu. */
function album(
  a: Spec,
  b: Spec,
  note: { main: string; sub: string },
  mirror: boolean,
  t: number,
): { photos: Photo[]; note: Note } {
  const [a1, a2] = tone(t);
  const [b1, b2] = tone(t + 1);
  const photos: Photo[] = [
    {
      src: IMG + a[0], alt: a[1], caption: a[2],
      x: mirror ? 36 : 8, y: 6, w: 56, r: mirror ? 3 : -3,
      ratio: '4 / 5', depth: 0.6, z: 1, arch: true, c1: a1, c2: a2,
    },
    {
      src: IMG + b[0], alt: b[1], caption: b[2],
      x: mirror ? 7 : 46, y: 45, w: 47, r: mirror ? -4 : 4,
      ratio: '1 / 1', depth: 1.3, z: 2, arch: false, c1: b1, c2: b2,
    },
  ];
  return {
    photos,
    note: { ...note, x: mirror ? 60 : 9, y: mirror ? 69 : 68, w: 32, r: mirror ? 5 : -5, depth: 0.9 },
  };
}

const CHAPTERS: Chapter[] = [
  {
    year: '2016',
    phase: '01 / Ủ ẤP',
    tagName: 'Ủ ấp',
    titleWords: words('Góc nhỏ bình yên & những chiếc phin nhôm đầu tiên'),
    textWords: words(
      'Khởi đầu từ một không gian nhỏ mang dáng dấp Sài Gòn cũ với khung cửa lá sách xanh và bàn gỗ mộc. Chúng tôi chọn lối đi chậm: rang mộc từng mẻ hạt, tự tay cân chỉnh độ mịn để giọt cà phê giữ được hậu vị ngọt sâu nguyên bản.',
    ),
    facts: [
      { k: 'Chỗ ngồi', v: '12' },
      { k: 'Loại hạt', v: '3' },
    ],
    ...album(
      ['2016-khoi-dau.webp', 'Góc quán nhỏ năm 2016', 'MẺ PHIN ĐẦU TIÊN'],
      ['2016-goc-quan.webp', 'Chiếc phin nhôm đầu tiên', 'chiếc phin đầu tay'],
      { main: 'Ly phin đầu tiên', sub: '14.03.2016 • 18.000đ' },
      false,
      0,
    ),
  },
  {
    year: '2018',
    phase: '02 / NẢY MẦM',
    tagName: 'Nảy mầm',
    titleWords: words('Tiệm nhỏ có thêm những người bạn quen'),
    textWords: words(
      'Sau hai năm, những vị khách đầu tiên đã thành khách quen với chiếc ghế riêng bên khung cửa lá sách. Chúng tôi mở thêm gác nhỏ, thử rang lẫn hạt Cầu Đất và Buôn Ma Thuột, rồi ghi tên từng người vào cuốn sổ "ly quen" treo sau quầy.',
    ),
    facts: [
      { k: 'Chỗ ngồi', v: '28' },
      { k: 'Khách quen', v: '150' },
    ],
    ...album(
      ['2018-khach-quen.webp', 'Khách quen bên khung cửa', 'ghế của khách quen'],
      ['2018-gac-nho.webp', 'Gác nhỏ của quán', 'gác nhỏ mới mở'],
      { main: 'Sổ "ly quen"', sub: 'trang đầu tiên' },
      true,
      1,
    ),
  },
  {
    year: '2022',
    phase: '03 / VỮNG VÀNG',
    tagName: 'Vững vàng',
    titleWords: words('Qua mùa dịch, giữ ấm một ngọn đèn phố'),
    textWords: words(
      'Đại dịch kéo dài hai năm, cửa quán nhiều lần phải đóng then. Chúng tôi chuyển sang bán mang đi và giao tận nhà, giữ trọn việc làm cho từng người trong quán, và treo những ly phin gửi tặng y bác sĩ. Đầu năm 2022, cửa lá sách mở lại, đèn vẫn sáng như chưa từng tắt.',
    ),
    facts: [
      { k: 'Ly gửi y bác sĩ', v: '2.000' },
      { k: 'Nhân viên ở lại', v: '100%' },
    ],
    ...album(
      ['2022-mang-di.webp', 'Ly cà phê trao qua ô cửa mang đi', 'Ô CỬA MANG ĐI'],
      ['2022-ly-treo.webp', 'Những ly cà phê treo gửi tặng', 'ly treo gửi tặng'],
      { main: 'Mùa phố vắng', sub: 'quán vẫn sáng đèn' },
      false,
      2,
    ),
  },
  {
    year: '2023',
    phase: '04 / LAN TỎA',
    tagName: 'Lan tỏa',
    titleWords: words('Mang hương phin ra khỏi bốn bức tường'),
    textWords: words(
      'Chúng tôi đóng gói những gói cà phê rang mộc, kèm chiếc phin nhôm nhỏ để ai cũng có thể pha một ly Sài Gòn tại nhà. Quán thêm góc đọc sách cũ và những buổi nhạc acoustic tối thứ bảy, hơi ấm vẫn từ ly phin tí tách như ngày đầu.',
    ),
    facts: [
      { k: 'Gói cà phê', v: '5.000+' },
      { k: 'Đêm nhạc', v: '48' },
    ],
    ...album(
      ['2023-goi-ca-phe.webp', 'Gói cà phê rang mộc', 'gói phin mang về nhà'],
      ['2023-acoustic.webp', 'Đêm nhạc acoustic', 'tối thứ bảy acoustic'],
      { main: 'Tối thứ bảy', sub: 'acoustic dưới đèn vàng' },
      true,
      3,
    ),
  },
  {
    year: '2026',
    phase: '05 / ĐẬM ĐÀ',
    tagName: 'Đậm đà',
    titleWords: words('Mười năm — Một ly phin vẹn nguyên cảm xúc'),
    textWords: words(
      'Từ 2016 đến 2026, chiếc phin nhôm vẫn ở đó, lớp sữa đặc dưới đáy ly vẫn ngọt ngào hoài niệm. Tròn một thập kỷ đi cùng năm tháng, mỗi ly cà phê trao tay hôm nay là sự kết tinh của 10 năm giữ lửa, đậm đà và sâu lắng hơn bao giờ hết.',
    ),
    facts: [
      { k: 'Năm giữ lửa', v: '10' },
      { k: 'Ly phin', v: '1 triệu+' },
    ],
    ...album(
      ['2026-thap-ky.webp', 'Tròn một thập kỷ hương vị', 'TRÒN MỘT THẬP KỶ'],
      ['2026-ly-phin.webp', 'Ly phin sữa đặc', 'ly phin hôm nay'],
      { main: 'Tròn 10 năm', sub: 'cảm ơn những ai đã ghé' },
      false,
      0,
    ),
  },
];

// Tờ i: mặt trước = trang chữ của chương i-1 (tờ 0 là bìa), mặt sau = trang ảnh của chương i
const LEAVES: Leaf[] = Array.from({ length: CHAPTERS.length + 1 }, (_, i) => ({
  index: i,
  text: CHAPTERS[i - 1],
  photos: CHAPTERS[i],
}));

const BEANS: Bean[] = [
  { x: 6, y: 14, s: 22, r: -30, o: 0.55, b: 0, depth: 0.8 },
  { x: 92, y: 20, s: 30, r: 40, o: 0.4, b: 2, depth: 1.4 },
  { x: 14, y: 78, s: 36, r: 20, o: 0.35, b: 3, depth: 1.6 },
  { x: 88, y: 74, s: 20, r: -50, o: 0.6, b: 0, depth: 0.6 },
  { x: 48, y: 6, s: 16, r: 70, o: 0.35, b: 1, depth: 1 },
  { x: 70, y: 90, s: 26, r: -20, o: 0.45, b: 1.5, depth: 1.2 },
  { x: 30, y: 92, s: 14, r: 10, o: 0.5, b: 0, depth: 0.5 },
  { x: 3, y: 46, s: 18, r: 55, o: 0.4, b: 1, depth: 0.9 },
];

/* ---------- Thông số nhịp animation (dễ chỉnh) ---------- */
const FLIP = 1.2; // thời lượng lật một trang (đơn vị timeline)
const STEP = 2; // khoảng cách giữa 2 lần lật (= lật + dừng đọc)
const SCROLL_VH = 6.8; // tổng quãng cuộn khi ghim, tính theo số màn hình
const CLOSE_GAP = 0.6; // đọc nốt trang cuối bao lâu thì bắt đầu đóng sách
const END_HOLD = 1.0; // dừng lại ngắm bìa sau khi sách đã đóng
const SCRUB = 1.6; // độ trễ scrub (càng lớn càng chậm, điện ảnh)
/** Chiều cao header cố định ở đầu trang (px) – dùng để chừa chỗ, không cho About chui dưới header */
const headerOffset = (): number => {
  // position:fixed nằm trên thẻ host <app-widget-landing-header>, không phải thẻ <header> bên trong
  const el =
    document.querySelector<HTMLElement>('app-widget-landing-header') ??
    document.querySelector<HTMLElement>('header');
  if (!el) return 0;
  const pos = getComputedStyle(el).position;
  // offsetHeight không bị ảnh hưởng bởi transform (animation y:-48 lúc header vào trang)
  return pos === 'fixed' || pos === 'sticky' ? el.offsetHeight : 0;
};

const TEXT_AT = 0.7; // chữ bắt đầu hiện sau khi bắt đầu lật bao lâu (nhỏ hơn = hiện sớm hơn)
const TEXT_SPREAD = 0.25; // tổng thời gian dàn đều toàn bộ chữ trên trang (nhỏ hơn = ra đồng loạt hơn)

@Component({
  selector: 'app-widget-landing-about',
  imports: [],
  templateUrl: './landingAbout.html',
  styleUrl: './landingAbout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingAbout {
  private readonly destroyRef = inject(DestroyRef);

  readonly ritualSection = viewChild.required<ElementRef<HTMLElement>>('ritualSection');

  readonly chapters = CHAPTERS;
  readonly leaves = LEAVES;
  readonly beans = BEANS;
  readonly coverLine1 = words('Mười năm cho một');
  readonly coverLine2 = words('mẻ phin tròn vị');

  /** Chương đang mở (-1 = chưa mở bìa) */
  readonly activeIndex = signal(-1);

  private mm?: gsap.MatchMedia;
  private pin?: ScrollTrigger;
  private tlTotal = 1;

  constructor() {
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => this.mm?.revert());
  }

  hideImg(e: Event): void {
    (e.target as HTMLElement).style.visibility = 'hidden';
  }

  /** Bấm vào mốc năm trên timeline */
  goTo(i: number): void {
    const section = this.ritualSection().nativeElement;
    if (this.pin) {
      // Chế độ sách: cuộn tới giữa giai đoạn đọc của chương i
      const t = i * STEP + FLIP + 0.4;
      const y = this.pin.start + (this.pin.end - this.pin.start) * (t / this.tlTotal);
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      // Mobile: vuốt carousel tới trang ảnh của chương i (thẻ số 2i+1, thẻ 0 là bìa)
      const book = section.querySelector<HTMLElement>('.book');
      const face = book?.querySelectorAll<HTMLElement>('.face')[i * 2 + 1];
      if (book && face) {
        book.scrollTo({ left: face.offsetLeft - (book.clientWidth - face.offsetWidth) / 2, behavior: 'smooth' });
      }
    }
  }

  /* =========================================================
     KHỞI TẠO: tách desktop / mobile bằng matchMedia
     ========================================================= */
  private init(): void {
    const section = this.ritualSection().nativeElement;
    const mm = gsap.matchMedia();
    this.mm = mm;

    mm.add(
      {
        book: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
        stacked: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
      },
      (ctx) => {
        const { book } = (ctx.conditions ?? {}) as Record<string, boolean>;
        return book ? this.buildBook(section) : this.buildStacked(section);
      },
    );

    // Font tải xong có thể làm lệch layout → tính lại vị trí
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }

  /* =========================================================
     DESKTOP: cuốn album 3D ghim màn hình, cuộn để lật trang
     ========================================================= */
  private buildBook(section: HTMLElement): () => void {
    const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = section): T[] =>
      Array.from(root.querySelectorAll<T>(sel));
    const one = (sel: string) => section.querySelector<HTMLElement>(sel);

    section.classList.add('is-book');

    const shift = one('.book-shift');
    const tilt = one('.book-tilt');
    const board = one('.book-board');
    const shadow = one('.book-shadow');
    const fill = one('.tl-fill');
    const watermark = one('.watermark');
    const leaves = $('.leaf');
    if (!shift || !tilt || !board || !shadow || !fill || !watermark || !leaves.length) {
      return () => section.classList.remove('is-book');
    }

    const flips = CHAPTERS.length;
    const CLOSE_AT = flips * STEP + CLOSE_GAP; // thời điểm lật tờ cuối (đóng sách)
    const TOTAL = CLOSE_AT + FLIP + END_HOLD;
    const front = (i: number) => leaves[i]?.querySelector<HTMLElement>('.face-front') ?? null;
    const back = (i: number) => leaves[i]?.querySelector<HTMLElement>('.face-back') ?? null;

    /* ---- Trạng thái ban đầu ---- */
    gsap.set(leaves, { transformOrigin: '0% 50%', rotationY: 0, zIndex: (i: number) => leaves.length - i });
    gsap.set(shift, { xPercent: -25 }); // sách đóng: bìa nằm giữa màn hình
    gsap.set(board, { clipPath: 'inset(0% 0% 0% 50%)' });
    gsap.set(shadow, { xPercent: -25, scaleX: 0.5 }); // sách đóng: bóng nằm dưới nửa phải
    gsap.set($('.bc-item'), { autoAlpha: 0, y: 14 }); // nội dung bìa sau chờ lúc đóng sách
    gsap.set(tilt, { transformPerspective: 1800 });
    gsap.set($('.text-page .wi'), { yPercent: 115 });
    gsap.set($('.polaroid .card'), { autoAlpha: 0, y: 46, scale: 0.92 });
    gsap.set($('.photo-inner'), { clipPath: 'inset(0% 0% 100% 0%)' }); // ảnh "mở màn trập" theo chiều dọc
    gsap.set($('.photo-inner img'), { scale: 1.3 });
    gsap.set($('.fact, .cta'), { autoAlpha: 0, y: 14 });

    this.coverIntro(section);
    this.bookEntrance(section, true);
    this.floatLoops(section);

    /* ---- Master timeline gắn với cuộn ---- */
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: () => 'top top+=' + headerOffset(), // ghim ngay dưới header, không bị header đè
        end: () => '+=' + Math.round(window.innerHeight * SCROLL_VH),
        pin: true,
        onRefreshInit: () => section.style.setProperty('--hdr', headerOffset() + 'px'),
        scrub: SCRUB,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
      onUpdate: () => this.setActiveFromTime(tl.time(), flips),
    });

    // Mở bìa: sách dịch về giữa, bìa cứng bung sang trái, bóng đổ rộng ra
    tl.to(shift, { xPercent: 0, duration: FLIP, ease: 'power2.inOut' }, 0)
      .to(board, { clipPath: 'inset(0% 0% 0% 0%)', duration: FLIP, ease: 'power2.inOut' }, 0)
      .to(shadow, { scaleX: 1, xPercent: -50, duration: FLIP, ease: 'power2.inOut' }, 0);

    // Các lớp parallax xa trôi suốt hành trình cuộn
    tl.fromTo(watermark, { xPercent: 8 }, { xPercent: -14, duration: TOTAL }, 0);
    tl.to(
      $('.bean'),
      { y: (_i: number, el: Element) => -Number((el as HTMLElement).dataset['depth'] ?? 1) * 260, duration: TOTAL },
      0,
    );
    tl.fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: (flips - 1) * STEP }, 0.6);

    // Từng lần lật trang
    leaves.forEach((leaf, i) => {
      const closing = i === flips; // tờ cuối: lật xong thì sách đóng lại
      const s = closing ? CLOSE_AT : i * STEP;
      const thisFront = front(i);
      const thisBack = back(i);
      const nextFront = front(i + 1);
      if (!thisFront || !thisBack) return;

      // Lật 180° quanh gáy sách, nhấc nhẹ ra phía trước rồi hạ xuống
      tl.set(leaf, { zIndex: 100 + i }, s)
        .to(leaf, { rotationY: -180, duration: FLIP, ease: 'power2.inOut' }, s)
        .to(leaf, { z: 36, duration: FLIP / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, s);

      // Bóng khi lật: mặt trước tối dần, mặt sau sáng dần, trang bên dưới được "mở sáng"
      const shadeF = thisFront.querySelector('.shade');
      const shadeB = thisBack.querySelector('.shade');
      const cast = nextFront?.querySelector('.cast');
      if (shadeF) tl.fromTo(shadeF, { opacity: 0 }, { opacity: 0.7, duration: FLIP / 2, ease: 'power1.in' }, s);
      if (shadeB) tl.fromTo(shadeB, { opacity: 0.7 }, { opacity: 0, duration: FLIP / 2, ease: 'power1.out' }, s + FLIP / 2);
      if (cast) tl.fromTo(cast, { opacity: 0.5 }, { opacity: 0, duration: FLIP, ease: 'power1.out' }, s);

      // Trang ảnh (mặt sau): polaroid lơ lửng hiện ra, ảnh mở bằng clip-path, parallax theo độ sâu
      const cards = $('.polaroid .card', thisBack);
      const inners = $('.photo-inner', thisBack);
      const imgs = $('.photo-inner img', thisBack);
      const polas = $('.polaroid', thisBack);
      if (cards.length) tl.to(cards, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.14, ease: 'power2.out' }, s + 0.55);
      if (cards.length) tl
        .to(inners, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, stagger: 0.14, ease: 'power2.inOut' }, s + 0.65)
        .to(imgs, { scale: 1, duration: 1.4, stagger: 0.14, ease: 'power2.out' }, s + 0.65)
        .to(
          polas,
          { y: (_i: number, el: Element) => -Number((el as HTMLElement).dataset['depth'] ?? 1) * 26, duration: 2.6 },
          s + 0.6,
        );

      // Trang chữ (mặt trước tờ kế): MỌI chữ (năm, tiêu đề, đoạn văn) trồi lên cùng lúc, nhanh và đều.
      // stagger.amount = tổng thời gian dàn trải, nên dù đoạn dài hay ngắn thì cả trang vẫn ra trong cùng một nhịp.
      if (nextFront) {
        tl.to($('.wi', nextFront), { yPercent: 0, duration: 0.5, stagger: { amount: TEXT_SPREAD }, ease: 'power3.out' }, s + TEXT_AT)
          .to(
            $('.fact, .cta', nextFront),
            { autoAlpha: 1, y: 0, duration: 0.45, stagger: { amount: 0.12 }, ease: 'power2.out' },
            s + TEXT_AT + 0.1,
          );
      }

      // Đóng sách: nhật ký khép lại về nửa trái, dịch ra giữa, bìa cứng thu theo, bìa sau lộ ra
      if (closing) {
        tl.to(shift, { xPercent: 25, duration: FLIP, ease: 'power2.inOut' }, s)
          .to(board, { clipPath: 'inset(0% 50% 0% 0%)', duration: FLIP, ease: 'power2.inOut' }, s)
          .to(shadow, { scaleX: 0.5, xPercent: -75, duration: FLIP, ease: 'power2.inOut' }, s)
          .to($('.bc-item'), { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out' }, s + FLIP * 0.7);
      }
    });

    tl.set({}, {}, TOTAL); // đảm bảo timeline có đủ độ dài (gồm đoạn dừng cuối)
    this.pin = tl.scrollTrigger ?? undefined;
    this.tlTotal = tl.duration();

    /* ---- Parallax theo con trỏ chuột: sách nghiêng nhẹ, ảnh trôi lệch theo độ sâu ---- */
    let detach = () => { };
    if (window.matchMedia('(hover: hover)').matches) {
      const tiltX = gsap.quickTo(tilt, 'rotationX', { duration: 1.2, ease: 'power3' });
      const tiltY = gsap.quickTo(tilt, 'rotationY', { duration: 1.2, ease: 'power3' });
      const drifts = $('.polaroid .drift');
      const dx = drifts.map((el) => gsap.quickTo(el, 'x', { duration: 1.4, ease: 'power3' }));
      const dy = drifts.map((el) => gsap.quickTo(el, 'y', { duration: 1.4, ease: 'power3' }));
      const onMove = (e: PointerEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        tiltY(nx * 6);
        tiltX(-ny * 4);
        drifts.forEach((el, i) => {
          const d = Number(el.parentElement?.dataset['depth'] ?? 1);
          dx[i]?.(-nx * d * 18);
          dy[i]?.(-ny * d * 14);
        });
      };
      section.addEventListener('pointermove', onMove);
      detach = () => section.removeEventListener('pointermove', onMove);
    }

    return () => {
      detach();
      this.pin = undefined;
      section.classList.remove('is-book');
    };
  }

  /* =========================================================
     MOBILE / MÀN NHỎ: xếp dọc, hiện dần từng khối
     ========================================================= */
  private buildStacked(section: HTMLElement): () => void {
    const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = section): T[] =>
      Array.from(root.querySelectorAll<T>(sel));

    gsap.set($('.text-page .wi'), { yPercent: 115 });
    gsap.set($('.polaroid .card'), { autoAlpha: 0, y: 34, scale: 0.94 });
    gsap.set($('.photo-inner'), { clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set($('.photo-inner img'), { scale: 1.25 });
    gsap.set($('.fact, .cta'), { autoAlpha: 0, y: 12 });

    this.coverIntro(section);
    this.bookEntrance(section, false);
    this.floatLoops(section);

    const book = section.querySelector<HTMLElement>('.book');
    const faces = book ? $('.face', book) : [];
    if (!book || !faces.length) return () => { };

    // Mỗi thẻ có một timeline nhỏ chờ sẵn, chạy 1 lần khi thẻ trượt vào giữa màn hình
    const reveals = new Map<Element, gsap.core.Timeline>();
    faces.forEach((face) => {
      const tl = gsap.timeline({ paused: true });
      if (face.querySelector('.photo-page')) {
        tl.to($('.polaroid .card', face), { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.14, ease: 'power2.out' }, 0)
          .to($('.photo-inner', face), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: 0.14, ease: 'power2.inOut' }, 0.1)
          .to($('.photo-inner img', face), { scale: 1, duration: 1.4, stagger: 0.14, ease: 'power2.out' }, 0.1);
      } else if (face.querySelector('.text-page')) {
        tl.to($('.year .wi', face), { yPercent: 0, duration: 0.9, ease: 'power3.out' }, 0)
          .to($('.title .wi', face), { yPercent: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' }, 0.1)
          .to($('.text .wi', face), { yPercent: 0, duration: 0.6, stagger: 0.01, ease: 'power3.out' }, 0.2)
          .to($('.fact, .cta', face), { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out' }, 0.5);
      }
      reveals.set(face, tl);
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          reveals.get(e.target)?.play();
          io.unobserve(e.target);
        });
      },
      { root: book, threshold: 0.55 },
    );
    faces.forEach((f) => io.observe(f));

    // Timeline năm theo thẻ đang nằm giữa carousel (thẻ 0 = bìa)
    let raf = 0;
    const updateActive = () => {
      raf = 0;
      const mid = book.scrollLeft + book.clientWidth / 2;
      let best = 0;
      let dist = Number.POSITIVE_INFINITY;
      faces.forEach((f, k) => {
        const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - mid);
        if (d < dist) {
          dist = d;
          best = k;
        }
      });
      this.activeIndex.set(best === 0 ? -1 : Math.min(CHAPTERS.length - 1, Math.floor((best - 1) / 2)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateActive);
    };
    book.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      book.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }

  /* =========================================================
     DÙNG CHUNG
     ========================================================= */

  /** Cuốn nhật ký "hiện ra" ngay khi section vừa lướt tới (chạy theo thời gian, 1 lần, không scrub) */
  private bookEntrance(section: HTMLElement, book: boolean): void {
    const stage = section.querySelector<HTMLElement>('.album-stage');
    const nav = section.querySelector<HTMLElement>('.timeline');
    if (!stage) return;
    gsap.set(
      stage,
      book
        ? { autoAlpha: 0, y: 110, scale: 0.88, rotationX: 16, transformPerspective: 1400, transformOrigin: '50% 100%' }
        : { autoAlpha: 0, y: 48 },
    );
    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 85%', once: true },
      defaults: { ease: 'power3.out' },
    });
    tl.to(
      stage,
      { autoAlpha: 1, y: 0, scale: 1, rotationX: 0, duration: 1.4, clearProps: 'transform,opacity,visibility' },
      0,
    );
    if (nav) tl.from(nav, { autoAlpha: 0, duration: 1, clearProps: 'opacity,visibility' }, 0.7);
  }

  /** Bìa sách: chữ trồi lên từng từ, con dấu đỏ "đóng" xuống sau cùng */
  private coverIntro(section: HTMLElement): void {
    const coverWords = Array.from(section.querySelectorAll<HTMLElement>('.cover .wi'));
    const fades = Array.from(
      section.querySelectorAll<HTMLElement>('.cover .emblem, .cover .kicker, .cover .label, .cover .years, .cover .hint, .cover .stain'),
    );
    const seal = section.querySelector<HTMLElement>('.cover .seal');
    gsap.set(coverWords, { yPercent: 115 });
    gsap.set(fades, { autoAlpha: 0, y: 16 });
    if (seal) gsap.set(seal, { autoAlpha: 0, scale: 1.9 });
    const tl = gsap
      .timeline({ scrollTrigger: { trigger: section, start: 'top 85%', once: true }, defaults: { ease: 'power3.out' } })
      .to(fades, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12 }, 0.5)
      .to(coverWords, { yPercent: 0, duration: 1.1, stagger: 0.08 }, 0.8);
    if (seal) tl.to(seal, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, 1.7);
  }

  /** Ảnh "lơ lửng": trôi lên xuống và xoay nhẹ, lệch pha nhau */
  private floatLoops(section: HTMLElement): void {
    section.querySelectorAll<HTMLElement>('.polaroid .float').forEach((el) => {
      gsap.to(el, {
        y: gsap.utils.random(-18, -10),
        rotation: gsap.utils.random(-1.6, 1.6),
        duration: gsap.utils.random(2.8, 4.4),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: gsap.utils.random(0, 2),
      });
    });
  }

  /** Chương i sáng lên khi tờ giấy lật qua nửa chừng */
  private setActiveFromTime(t: number, flips: number): void {
    const idx = t < 0.6 ? -1 : Math.min(flips - 1, Math.floor((t - 0.6) / STEP));
    this.activeIndex.set(idx);
  }
}