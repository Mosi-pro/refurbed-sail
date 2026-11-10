import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { LoadingState } from "./components/ui";
import { useAuth } from "./hooks/useAuth";
import { SiteLayout } from "./layouts/SiteLayout";
import { AccountFavorites, AccountLayout, AccountListings, AccountMessages, AccountOverview, AccountProfile, AccountSettings } from "./pages/Account";
import { AdminAudit, AdminBoats, AdminDealers, AdminLayout, AdminOverview, AdminRefurb, AdminReports, AdminUsers } from "./pages/Admin";
import { ForgotPassword, Login, Register, ResetPassword } from "./pages/Auth";
import BoatDetail from "./pages/BoatDetail";
import Boats, { BoatsPage } from "./pages/Boats";
import { DealerDocuments, DealerInquiries, DealerLayout, DealerListings, DealerOverview, DealerProfile, DealerReports } from "./pages/DealerDashboard";
import { BecomeDealer, DealerDirectory, DealerPublic } from "./pages/Dealers";
import Home from "./pages/Home";
import ListingEditor from "./pages/ListingEditor";
import { About, Contact, Help, HowItWorks, Imprint, NotFound, Privacy, Terms } from "./pages/Static";

/** /haendler is the dealer administration for dealers and the public directory for everyone else. */
function DealerEntry() {
  const { loading, hasRole } = useAuth();
  if (loading) return <LoadingState />;
  return hasRole("dealer") ? <DealerLayout /> : <DealerDirectory />;
}
const dealerOnly = (el: JSX.Element) => <RequireAuth role="dealer">{el}</RequireAuth>;

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="boote" element={<Boats />} />
        <Route path="boote/:slug" element={<BoatDetail />} />
        <Route path="refurbished" element={<BoatsPage refurbishedOnly />} />
        <Route path="so-funktionierts" element={<HowItWorks />} />

        <Route path="haendler/verzeichnis" element={<DealerDirectory />} />
        <Route path="haendler/werden" element={<BecomeDealer />} />
        <Route path="haendler" element={<DealerEntry />}>
          <Route index element={<DealerOverview />} />
          <Route path="inserate" element={dealerOnly(<DealerListings />)} />
          <Route path="anfragen" element={dealerOnly(<DealerInquiries />)} />
          <Route path="anfragen/:id" element={dealerOnly(<DealerInquiries />)} />
          <Route path="berichte" element={dealerOnly(<DealerReports />)} />
          <Route path="dokumente" element={dealerOnly(<DealerDocuments />)} />
          <Route path="profil" element={dealerOnly(<DealerProfile />)} />
        </Route>
        <Route path="haendler/:slug" element={<DealerPublic />} />

        <Route path="anmelden" element={<Login />} />
        <Route path="registrieren" element={<Register />} />
        <Route path="passwort-vergessen" element={<ForgotPassword />} />
        <Route path="passwort-zuruecksetzen" element={<ResetPassword />} />

        <Route path="merkliste" element={<Navigate to="/konto/merkliste" replace />} />
        <Route path="konto" element={<RequireAuth><AccountLayout /></RequireAuth>}>
          <Route index element={<AccountOverview />} />
          <Route path="inserate" element={<AccountListings />} />
          <Route path="nachrichten" element={<AccountMessages />} />
          <Route path="nachrichten/:id" element={<AccountMessages />} />
          <Route path="merkliste" element={<AccountFavorites />} />
          <Route path="profil" element={<AccountProfile />} />
          <Route path="einstellungen" element={<AccountSettings />} />
        </Route>
        <Route path="inserat-erstellen" element={<RequireAuth><ListingEditor /></RequireAuth>} />
        <Route path="inserat-erstellen/:id" element={<RequireAuth><ListingEditor /></RequireAuth>} />

        <Route path="admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
          <Route index element={<AdminOverview />} />
          <Route path="inserate" element={<AdminBoats />} />
          <Route path="meldungen" element={<AdminReports />} />
          <Route path="haendler" element={<AdminDealers />} />
          <Route path="berichte" element={<AdminRefurb />} />
          <Route path="nutzer" element={<AdminUsers />} />
          <Route path="protokoll" element={<AdminAudit />} />
        </Route>

        <Route path="ueber-uns" element={<About />} />
        <Route path="kontakt" element={<Contact />} />
        <Route path="hilfe" element={<Help />} />
        <Route path="impressum" element={<Imprint />} />
        <Route path="datenschutz" element={<Privacy />} />
        <Route path="agb" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
