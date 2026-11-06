import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatUsd, officePreview } from "../preview";
import { Pricing } from "./Pricing";

const preview = officePreview();

export function Landing() {
  useEffect(() => {
    document.title = "QuoteCage · which vendor is cheapest after freight";
  }, []);
  return (
    <main id="content">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker light">Vultr Agent Rush · Challenge 1</p>
          <h1>Which vendor is cheapest after freight?</h1>
          <p className="lede">QuoteCage takes a small-business shopping list, opens each supplier in a throwaway browser, and brings back price, stock, and shipping with screenshots. It will not email a vendor, submit a form, or check out unless a person says so. This demo never places an order.</p>
          <div className="hero-actions">
            <Link className="button primary" to="/app">Compare a sample list</Link>
            <Link className="button ghost" to="/security">See the containment</Link>
          </div>
        </div>
        <aside className="preview" aria-label="Fixture preview of the office sample">
          <p className="preview-label">Fixture preview · office restock · not a customer result</p>
          <table>
            <caption className="sr-only">Sample totals from the included fixture stores</caption>
            <thead>
              <tr><th>Vendor</th><th>After freight</th><th>Note</th></tr>
            </thead>
            <tbody>
              {preview.quotes.map((quote) => {
                const name = previewName(quote.vendorId);
                const recommended = quote.vendorId === preview.rec.bestValueVendorId;
                return (
                  <tr key={quote.vendorId} className={recommended ? "is-best" : ""}>
                    <td>{name}</td>
                    <td>{quote.complete ? formatUsd(quote.totalCents) : "—"}</td>
                    <td>{noteFor(quote.vendorId, quote.complete, quote.tainted, recommended)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="preview-note">{preview.summary}</p>
        </aside>
      </section>

      <section className="section" id="problem">
        <div className="section-head">
          <p className="kicker">The job</p>
          <h2>The same three SKUs, four tabs, and a freight line that shows up in the cart.</h2>
          <p>Someone buying for a small office or a print shop already knows the pain: pages and PDFs that do not line up, a unit that changes, shipping that appears late, and a spreadsheet with no record of what the page actually said. QuoteCage is for that weekly list. We have not run our own buyer interviews this week. The pain is the one procurement tools describe, and we are not treating anyone else’s marketing statistic as our measurement.</p>
        </div>
        <div className="steps">
          <article><h3>01 · The list</h3><p>Paste “A4 paper 10 reams, toner HP 26A x2, office chairs x4.” A planner on the control plane turns that into quantities and SKUs.</p></article>
          <article><h3>02 · One browser each</h3><p>Every vendor gets a new container. It searches, screenshots, and reads the cart. Then the container is removed.</p></article>
          <article><h3>03 · Check the pixels</h3><p>With an inference key, a vision model looks at the cart screenshot. Without one, the app cross-checks the captured text and shows which check ran.</p></article>
          <article><h3>04 · A person decides</h3><p>The recommendation is the lowest total that can ship every line and did not trip containment. Contacting the vendor stays behind Approve or Deny.</p></article>
        </div>
      </section>

      <section className="band">
        <div>
          <p className="kicker light">Containment, in the same story</p>
          <h2>One of the fixture stores tries to take the agent off the list.</h2>
          <p>QuickQuote Depot is fictional. Its page tells the agent to email a contact list, post secrets to an outside host, and check out. The sandbox blocks the outside call, the action waits for a person, and the lower sticker price is not the recommendation.</p>
        </div>
        <ul className="checks">
          <li>No API key in the sandbox</li>
          <li>Allowlist, not the open internet</li>
          <li>Read-only root, capabilities dropped</li>
          <li>Container id, then destroyed</li>
          <li>SHA-256 on every screenshot</li>
        </ul>
      </section>

      <Pricing />
      <footer className="site-foot">
        <p>QuoteCage is a hackathon MVP by Zoon Software for the lablab.ai Vultr Agent Rush, Challenge 1. The four stores are fictional fixtures.</p>
      </footer>
    </main>
  );
}

function previewName(id: string) {
  if (id === "reedmill") return "Reed & Mill";
  if (id === "brightcartridge") return "Bright Cartridge";
  if (id === "oakline") return "Oakline Interiors";
  return "QuickQuote Depot";
}

function noteFor(id: string, complete: boolean, tainted: boolean, recommended: boolean) {
  if (recommended) return "Recommended";
  if (tainted) return "Held";
  if (!complete) return id === "brightcartridge" ? "Chair out of stock" : "Incomplete";
  return "In stock";
}
