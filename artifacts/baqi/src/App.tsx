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
    colorPrimary: '#204a3d',
    colorForeground: '#203e34',
    colorMutedForeground: '#66746a',
    colorDanger: '#a34f3b',
    colorBackground: '#fbf8f0',
    colorInput: '#ffffff',
    colorInputForeground: '#203e34',
    colorNeutral: '#203e34',
    fontFamily: "'Manrope', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f0] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#203e34] font-bold',
    headerSubtitle: 'text-[#66746a]',
    socialButtonsBlockButtonText: 'text-[#203e34]',
    formFieldLabel: 'text-[#536257]',
    footerActionLink: 'text-[#204a3d]',
    footerActionText: 'text-[#66746a]',
    dividerText: 'text-[#66746a]',
    identityPreviewEditButton: 'text-[#204a3d]',
    formFieldSuccessText: 'text-[#315a46]',
    alertText: 'text-[#8e3e31]',
    logoBox: 'rounded-lg',
    logoImage: 'object-contain',
    socialButtonsBlockButton: 'border border-[#ded5c5] bg-white',
    formButtonPrimary: 'bg-[#204a3d] text-white',
    formFieldInput: 'border-[#d9cfbd] bg-white text-[#203e34]',
    footerAction: 'text-[#66746a]',
    dividerLine: 'bg-[#ded5c5]',
    alert: 'border-[#e5c5b8] bg-[#fff6f2]',
    otpCodeFieldInput: 'border-[#d9cfbd] bg-white text-[#203e34]',
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
