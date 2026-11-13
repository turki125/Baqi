import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { arSA, enUS } from '@clerk/localizations';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Router as WouterRouter, useLocation } from 'wouter';
import BaqiApp from './BaqiApp';
import { clearPrivateSessionState } from './lib/baqi';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 20_000 },
    mutations: { retry: 0 },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in the app environment.');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#075E54',
    colorForeground: '#182226',
    colorMutedForeground: '#56636A',
    colorDanger: '#B8322A',
    colorBackground: '#FFFFFF',
    colorInput: '#FFFFFF',
    colorInputForeground: '#182226',
    colorNeutral: '#182226',
    fontFamily: 'var(--app-font-body)',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#DDE2E6] shadow-[0_1px_2px_rgba(24,34,38,.05)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#182226] font-semibold',
    headerSubtitle: 'text-[#56636A]',
    socialButtonsBlockButtonText: 'text-[#182226] font-medium',
    formFieldLabel: 'text-[#182226] font-medium',
    footerActionLink: 'text-[#075E54] font-semibold',
    footerActionText: 'text-[#56636A]',
    dividerText: 'text-[#56636A]',
    identityPreviewEditButton: 'text-[#075E54]',
    formFieldSuccessText: 'text-[#22694A]',
    alertText: 'text-[#8F2620]',
    logoBox: 'rounded-lg',
    logoImage: 'object-contain',
    socialButtonsBlockButton: 'border border-[#CED5DA] bg-white',
    formButtonPrimary: 'bg-[#075E54] text-white font-semibold rounded-xl',
    formFieldInput: 'border-[#CED5DA] bg-white text-[#182226] rounded-xl',
    footerAction: 'text-[#56636A]',
    dividerLine: 'bg-[#DDE2E6]',
    alert: 'border-[#F2C4BF] bg-[#FDECEA]',
    otpCodeFieldInput: 'border-[#CED5DA] bg-white text-[#182226]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useRef<string | null | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (client.current !== undefined && client.current !== userId) {
        queryClient.clear();
        if (client.current) clearPrivateSessionState();
      }
      client.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<'en' | 'ar'>(() => (
    localStorage.getItem('baqi-language') === 'ar' ? 'ar' : 'en'
  ));

  useEffect(() => {
    const updateLanguage = (event: Event) => {
      const detail = (event as CustomEvent<'en' | 'ar'>).detail;
      if (detail === 'en' || detail === 'ar') setLanguage(detail);
    };
    window.addEventListener('baqi-language-change', updateLanguage);
    return () => window.removeEventListener('baqi-language-change', updateLanguage);
  }, []);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={language === 'ar' ? arSA : enUS}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      {children}
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ClerkProviderWithRoutes>
            <RoutedErrorBoundary>
              <BaqiApp />
            </RoutedErrorBoundary>
          </ClerkProviderWithRoutes>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
