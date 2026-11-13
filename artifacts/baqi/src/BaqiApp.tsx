import { useState } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { LanguageProvider } from './baqi/lang';
import { Shell } from './baqi/ui';
import CatalogPage from './baqi/pages/catalog';
import TeamPage from './baqi/pages/team';
import WelcomeScreen from './baqi/pages/welcome';
import ListingPage from './baqi/pages/listing';
import SellPage from './baqi/pages/sell';
import AuthPage from './baqi/pages/auth';
import { ChatPage, MessagesPage } from './baqi/pages/messages';
import { OrderDetailPage, OrdersPage } from './baqi/pages/orders';
import { AlertsPage, EmailUnsubscribePage } from './baqi/pages/alerts';
import { AccountPage, HelpPage, NotFoundPage, WalletPage } from './baqi/pages/account';

const WELCOME_COMPLETED_KEY = 'baqi-welcome-completed';

export default function BaqiApp() {
  const [welcomeCompleted, setWelcomeCompleted] = useState(() => {
    try {
      return window.localStorage.getItem(WELCOME_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [, setLocation] = useLocation();
  const completeWelcome = () => {
    try {
      window.localStorage.setItem(WELCOME_COMPLETED_KEY, 'true');
    } catch {
      // Continue into the marketplace for this session if storage is unavailable.
    }
    setWelcomeCompleted(true);
  };
  const sellFromWelcome = () => {
    completeWelcome();
    setLocation('/sell');
  };

  return <LanguageProvider>
    <Switch>
      <Route path="/team"><TeamPage /></Route>
      <Route path="/sign-in/*?"><AuthPage mode="sign-in" /></Route>
      <Route path="/sign-up/*?"><AuthPage mode="sign-up" /></Route>
      <Route path="/">
        {welcomeCompleted
          ? <Shell><CatalogPage /></Shell>
          : <WelcomeScreen onBrowse={completeWelcome} onSell={sellFromWelcome} onSkip={completeWelcome} />}
      </Route>
      <Route path="/listing/:id"><Shell><ListingPage /></Shell></Route>
      <Route path="/sell"><Shell><SellPage /></Shell></Route>
      <Route path="/messages"><Shell><MessagesPage /></Shell></Route>
      <Route path="/messages/:id"><Shell><ChatPage /></Shell></Route>
      <Route path="/orders"><Shell><OrdersPage /></Shell></Route>
      <Route path="/orders/:id"><Shell><OrderDetailPage /></Shell></Route>
      <Route path="/wallet"><Shell><WalletPage /></Shell></Route>
      <Route path="/account/alerts"><Shell><AlertsPage /></Shell></Route>
      <Route path="/email-unsubscribe"><Shell><EmailUnsubscribePage /></Shell></Route>
      <Route path="/account"><Shell><AccountPage /></Shell></Route>
      <Route path="/help"><Shell><HelpPage /></Shell></Route>
      <Route><Shell><NotFoundPage /></Shell></Route>
    </Switch>
  </LanguageProvider>;
}
