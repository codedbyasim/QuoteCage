import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { PricingPage } from "./components/Pricing";
import { SecurityPage } from "./components/SecurityPage";
import { Workspace } from "./components/Workspace";

export function App() {
  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/app" element={<Workspace />} />
        <Route path="/app/:runId" element={<Workspace />} />
        <Route path="*" element={<Missing />} />
      </Routes>
    </>
  );
}

function Missing() {
  useEffect(() => {
    document.title = "Not found · QuoteCage";
  }, []);
  return (
    <main id="content" className="page narrow">
      <h1>That page is not in QuoteCage.</h1>
      <p><a href="/">Back to the start</a></p>
    </main>
  );
}
