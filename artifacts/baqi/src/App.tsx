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
    colorPrimary: '#C63D0E',
    colorForeground: '#191B18',
    colorMutedForeground: '#666761',
    colorDanger: '#B8322A',
    colorBackground: '#FFFFFF',
    colorInput: '#FFFFFF',
    colorInputForeground: '#191B18',
    colorNeutral: '#191B18',
    fontFamily: 'var(--app-font-sans)',
    borderRadius: '0.25rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-sm w-[440px] max-w-full overflow-hidden border border-[#D7D7D0] shadow-[0_1px_2px_rgba(25,27,24,.04)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#191B18] font-semibold',
    headerSubtitle: 'text-[#666761]',
    socialButtonsBlockButtonText: 'text-[#191B18] font-medium',
    formFieldLabel: 'text-[#191B18] font-medium',
    footerActionLink: 'text-[#C63D0E] font-semibold',
    footerActionText: 'text-[#666761]',
    dividerText: 'text-[#666761]',
    identityPreviewEditButton: 'text-[#C63D0E]',
    formFieldSuccessText: 'text-[#C63D0E]',
    alertText: 'text-[#8F2620]',
    logoBox: 'h-8 w-auto rounded-none',
    logoImage: 'h-8 w-auto object-contain',
    socialButtonsBlockButton: 'border border-[#D7D7D0] bg-white',
    formButtonPrimary: 'bg-[#C63D0E] text-white font-semibold rounded-sm',
    formFieldInput: 'border-[#D7D7D0] bg-white text-[#191B18] rounded-sm',
    footerAction: 'text-[#666761]',
    dividerLine: 'bg-[#D7D7D0]',
    alert: 'border-[#F2C4BF] bg-[#FDECEA]',
    otpCodeFieldInput: 'border-[#D7D7D0] bg-white text-[#191B18]',
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
