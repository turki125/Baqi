import { Route, Switch } from 'wouter';
import { LanguageProvider } from './baqi/lang';
import { Shell } from './baqi/ui';
import CatalogPage from './baqi/pages/catalog';
import ListingPage from './baqi/pages/listing';
import SellPage from './baqi/pages/sell';
import AuthPage from './baqi/pages/auth';
import { ChatPage, MessagesPage } from './baqi/pages/messages';
import { OrderDetailPage, OrdersPage } from './baqi/pages/orders';
import { AlertsPage, EmailUnsubscribePage } from './baqi/pages/alerts';
import { AccountPage, HelpPage, NotFoundPage, WalletPage } from './baqi/pages/account';

export default function BaqiApp() {
  return <LanguageProvider>
    <Switch>
      <Route path="/sign-in/*?"><AuthPage mode="sign-in" /></Route>
      <Route path="/sign-up/*?"><AuthPage mode="sign-up" /></Route>
      <Route path="/"><Shell><CatalogPage /></Shell></Route>
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
