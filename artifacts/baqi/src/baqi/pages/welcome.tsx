import { useState } from 'react';
import { ArrowDown, ArrowUpRight, Pause, Play } from 'lucide-react';
import { basePath } from '@/lib/baqi';
import { useLang } from '../lang';
import { btn, Button, Logo } from '../ui';

type WelcomeScreenProps = {
  onBrowse: () => void;
  onSell: () => void;
  onSkip: () => void;
};

export default function WelcomeScreen({ onBrowse, onSell, onSkip }: WelcomeScreenProps) {
  const { tr } = useLang();
  const [isPaused, setIsPaused] = useState(false);

  const steps = [
    { number: '01', title: tr('Discover materials', 'اكتشف المواد'), detail: tr('Find what your project needs.', 'اعثر على ما يحتاجه مشروعك.') },
    { number: '02', title: tr('Contact the seller', 'تواصل مع البائع'), detail: tr('Ask a question and agree directly.', 'اسأل واتفق مباشرةً.') },
    { number: '03', title: tr('Arrange pickup', 'رتّب الاستلام'), detail: tr('Give useful materials a new start.', 'امنح المواد المفيدة بداية جديدة.') },
  ];

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#FCFCFA] text-[#191B18]" data-testid="page-welcome">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12 lg:py-7">
        <div data-testid="brand-wordmark"><Logo /></div>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex min-h-10 items-center gap-2 px-1 text-sm font-semibold text-[#5B5D57] transition-colors hover:text-[#C63D0E]"
          data-testid="button-skip"
        >
          {tr('Skip', 'تخطّي')} <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </header>

      <section className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-8 px-5 pb-9 pt-5 sm:px-8 sm:pb-12 md:gap-10 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] lg:gap-12 lg:px-12 lg:pb-14 lg:pt-7">
        <div className="relative z-10 min-w-0 max-w-[660px] lg:py-8">
          <p className="technical-label mb-6 flex items-center gap-3 text-[#777970]" data-testid="text-welcome-kicker">
            <span className="h-px w-8 bg-[#F45A24]" />
            {tr('A better use for what remains / Riyadh', 'استخدام أفضل للفائض / الرياض')}
          </p>
          <h1 className="max-w-full break-words text-[clamp(2.15rem,6vw,4.5rem)] font-semibold leading-[1.12] tracking-[-.045em]" data-testid="heading-welcome">
            <span className="brand-type block text-[1.02em] font-extrabold tracking-[-.04em]" lang="ar" dir="rtl">
              باقي <span className="text-[#F45A24]">فيه خير.</span>
            </span>
            <span className="mt-4 block text-[.47em] font-medium leading-[1.35] tracking-[-.03em] text-[#565851] sm:mt-5">
              {tr('Your project’s surplus, another project’s start.', 'فائض مشروعك، بداية لمشروع غيرك.')}
            </span>
          </h1>
          <p className="mt-5 max-w-[510px] text-[15px] leading-7 text-[#686A63] sm:mt-6 sm:text-base sm:leading-8" data-testid="text-welcome-description">
            {tr('Buy, sell, or give away surplus building materials in Riyadh.', 'اشترِ، بِع، أو تبرّع بفائض مواد البناء في الرياض.')}
          </p>

          <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row sm:mt-8">
            <Button onClick={onBrowse} size="lg" testId="button-browse" className="w-full rounded-sm bg-[#C63D0E] px-6 text-white hover:bg-[#A9320D] min-[420px]:w-auto">
              {tr('Browse materials', 'أبحث عن مواد')}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Button>
            <Button onClick={onSell} variant="outline" size="lg" testId="button-sell" className="w-full rounded-sm border-[#D5D4CD] bg-transparent px-6 hover:border-[#C63D0E] hover:bg-[#F7F6F1] min-[420px]:w-auto">
              {tr('Offer my surplus', 'أعرض فائضي')}
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] font-medium text-[#777970]" data-testid="text-browse-note">
            <span className="inline-block size-1.5 rounded-full bg-[#F45A24]" />
            {tr('Browse without an account.', 'تصفّح دون حساب.')}
          </div>
        </div>

        <div className="relative min-w-0">
          <div
            className={`material-stage surface-grid mx-auto w-full max-w-[680px] rounded-sm ${isPaused ? 'is-paused' : ''}`}
            dir="ltr"
            role="group"
            aria-label={tr('Decorative arrangement of limestone, timber and chrome', 'تكوين زخرفي من الحجر والخشب والكروم')}
            data-testid="material-artwork"
          >
            <img
              className="material-piece tiles"
              src={`${basePath}/demo-tiles.jpg`}
              alt={tr('Limestone tiles, ready to be reused', 'بلاط من الحجر الجيري جاهز لإعادة الاستخدام')}
              data-testid="image-limestone"
            />
            <img
              className="material-piece timber"
              src={`${basePath}/demo-timber.jpg`}
              alt={tr('Timber boards with a warm natural grain', 'ألواح خشبية بعروق طبيعية دافئة')}
              data-testid="image-timber"
            />
            <span aria-hidden="true" className="material-piece chrome" />
            <span className="technical-label absolute start-3 top-3 z-10 bg-[#F3F2EC]/90 px-2 py-1 text-[#777970] max-[360px]:hidden sm:start-5 sm:top-5">
              {tr('Material study / Riyadh', 'دراسة المواد / الرياض')}
            </span>
            <span className="technical-label absolute bottom-3 end-3 z-10 bg-[#F3F2EC]/90 px-2 py-1 text-[#777970] sm:bottom-5 sm:end-5">
              24°42′ N — 46°40′ E
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            className="welcome-motion-toggle absolute end-0 top-3 z-20 inline-flex min-h-10 items-center gap-2 border border-[#D9D8D1] bg-[#FCFCFA]/95 px-3 text-xs font-semibold text-[#555750] transition-colors hover:border-[#C63D0E] hover:text-[#C63D0E] sm:end-2 sm:top-5"
            aria-pressed={isPaused}
            aria-label={isPaused ? tr('Resume artwork motion', 'استئناف حركة العمل الفني') : tr('Pause artwork motion', 'إيقاف حركة العمل الفني')}
            data-testid="button-motion-toggle"
          >
            {isPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            <span>{isPaused ? tr('Resume motion', 'استئناف الحركة') : tr('Pause motion', 'إيقاف الحركة')}</span>
          </button>
          <p className="technical-label mt-3 text-end text-[#8A8B84]" data-testid="text-artwork-caption">
            {tr('Keep useful materials in motion', 'أبقِ المواد المفيدة في دورة الاستخدام')}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-5 pb-8 sm:px-8 lg:px-12" aria-labelledby="steps-heading">
        <div className="border-t border-[#D9D8D1]">
          <div className="flex flex-wrap items-center justify-between gap-4 py-5 sm:py-6">
            <div className="flex items-center gap-3">
              <span className="h-px w-7 bg-[#F45A24]" />
              <h2 id="steps-heading" className="technical-label text-[#777970]">{tr('A simple exchange', 'تبادل بسيط')}</h2>
            </div>
            <ArrowDown size={15} className="text-[#9A9B94]" aria-hidden="true" />
          </div>
          <ol className="grid grid-cols-1 border-t border-[#E4E3DD] sm:grid-cols-3" data-testid="list-welcome-steps">
            {steps.map((step, index) => (
              <li key={step.number} className={`min-w-0 py-5 sm:py-6 ${index > 0 ? 'border-t border-[#E4E3DD] sm:border-s sm:border-t-0 sm:ps-6 lg:ps-8' : 'sm:pe-6 lg:pe-8'}`} data-testid={`step-welcome-${step.number}`}>
                <span className="technical-label text-[#F45A24]">{step.number}</span>
                <h3 className="mt-2 text-[15px] font-semibold tracking-[-.01em]">{step.title}</h3>
                <p className="mt-1 text-[13px] leading-6 text-[#777970]">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 border-t border-[#E4E3DD] px-5 py-4 text-[11px] text-[#898A83] sm:px-8 lg:px-12">
        <span className="technical-label">{tr('Made for Riyadh / 24°42′ N', 'للرياض / ٢٤°٤٢′ شمالاً')}</span>
        <span className="baqi-wordmark baqi-wordmark-compact" aria-hidden="true"><span>baqi</span><span className="baqi-wordmark-dot">.</span></span>
      </footer>
    </main>
  );
}
