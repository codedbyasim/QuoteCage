import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Pricing } from "./Pricing";

export function Landing() {
  useEffect(() => {
    document.title = "QuoteCage · compare real store prices without ordering";
  }, []);
  return (
    <main id="content">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker light">For a person buying this week</p>
          <h1>Compare real store prices. Don't place the order.</h1>
          <p className="lede">Paste a shopping list. QuoteCage opens each store in a sealed browser, reads the price on the page, and waits for you before any vendor contact.</p>
          <div className="hero-actions">
            <Link className="button primary" to="/app">Compare real stores</Link>
            <Link className="button ghost" to="/app?mode=safety">Safety demo</Link>
          </div>
        </div>
        <ol className="how" aria-label="How QuoteCage works">
          <li><span>1</span><strong>Paste the list</strong><p>A toner, a ream of paper, a chair.</p></li>
          <li><span>2</span><strong>Sealed visits</strong><p>Each store gets its own browser. It is destroyed when it finishes.</p></li>
          <li><span>3</span><strong>Compare, then approve</strong><p>You see the page. Nothing is emailed or ordered unless you say so.</p></li>
        </ol>
      </section>

      <section className="section" id="problem">
        <div className="section-head">
          <p className="kicker">How to use it</p>
          <h2>Three steps, then you decide.</h2>
          <p>The stores in the default list are public sites that showed prices from a datacenter network when this was checked. If a site blocks the browser, the card says so. A price that a vision model did not confirm stays marked unverified. QuoteCage does not fill in a number that was not on the page.</p>
        </div>
        <div className="steps">
          <article><h3>Paste</h3><p>Use the example “HP 26A toner” or type your own list. The planner only turns that into search words.</p></article>
          <article><h3>Pick stores</h3><p>Quill, CDW, IKEA, and JAM Paper are ready. You can also paste one https link of your own.</p></article>
          <article><h3>Read the result</h3><p>Screenshots, the price text, and a timeline. Requesting a quote only drafts an email for you to copy.</p></article>
        </div>
      </section>

      <section className="band">
        <div>
          <p className="kicker light">Containment, in the same story</p>
          <h2>Want to see a hostile page get blocked?</h2>
          <p>The safety demo uses fictional shops, including one that tells the browser to email a contact list and call an outside host. That path is optional. Real comparisons never use those made-up prices.</p>
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
        <p>QuoteCage is a hackathon MVP by Zoon Software for the lablab.ai Vultr Agent Rush, Challenge 1. Real stores are visited read-only. The safety demo uses fictional fixture shops.</p>
      </footer>
    </main>
  );
}

