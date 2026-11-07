import { formatUsd } from "../preview";
import type { VendorView } from "../types";

export function VendorCard({
  vendor,
  recommended,
  cheapest,
  onRequestQuote,
}: {
  vendor: VendorView;
  recommended: boolean;
  cheapest: boolean;
  onRequestQuote: (vendorId: string) => void;
}) {
  const quote = vendor.quote;
  const memory = vendor.sandbox?.memory ? `${Math.round(vendor.sandbox.memory / (1024 * 1024))} MB` : null;
  return (
    <article className={`vendor ${recommended ? "is-best" : ""} ${quote?.tainted ? "is-held" : ""}`}>
      <header>
        <div>
          <h3>{vendor.name}</h3>
          <p>{vendor.tagline || vendor.shippingLabel}</p>
        </div>
        <div className="badges">
          {recommended ? <span className="badge pine">Recommended</span> : null}
          {cheapest && quote?.tainted ? <span className="badge oxide">Lowest sticker, held</span> : null}
          {quote && !quote.complete ? <span className="badge brass">Incomplete</span> : null}
          {!quote && vendor.status === "failed" ? <span className="badge oxide">No quote</span> : null}
        </div>
      </header>
      <p className="total">{quote?.live ? liveHeadline(quote) : quote ? formatUsd(quote.totalCents) : vendor.status === "pending" || vendor.status === "starting" ? "Waiting" : "—"}</p>
      {quote?.live ? (
        <>
          {quote.blockReason ? <p>{quote.blockReason}</p> : null}
          <ul className="line-list">
            {quote.lines.map((line) => (
              <li key={`${line.sku}-${line.name}`}>
                <span>{line.name}</span>
                <span>{line.unitPriceCents != null ? formatUsd(line.unitPriceCents) : "No price read"}</span>
                <span className="span-2">{line.note || "Seen on the page"}</span>
              </li>
            ))}
          </ul>
          <p className="check">{verificationCopy(quote.verification)}</p>
        </>
      ) : quote ? (
        <ul className="line-list">
          {quote.lines.map((line) => (
            <li key={`${line.sku}-${line.name}`}>
              <span>{line.name}</span>
              <span>{line.qty} {line.unit}</span>
              <span>{line.stock === "in_stock" ? formatUsd(line.unitPriceCents) : stockWord(line.stock)}</span>
              <span>{line.lineTotalCents == null ? "—" : formatUsd(line.lineTotalCents)}</span>
            </li>
          ))}
          <li><span>{quote.shippingLabel}</span><span /><span /><span>{formatUsd(quote.shippingCents)}</span></li>
          {quote.fees.map((fee) => (
            <li key={fee.label}><span>{fee.label}</span><span /><span /><span>{formatUsd(fee.amountCents)}</span></li>
          ))}
        </ul>
      ) : (
        <p className="muted">{vendor.error || "This vendor has not returned a cart yet."}</p>
      )}
      {vendor.vision ? (
        <p className="check">
          {vendor.vision.match ? "Cart check agrees with the extracted total." : "Cart check does not fully agree."}{" "}
          <span className="muted">{vendor.vision.model?.model ? `Vision model ${vendor.vision.model.model}.` : "Deterministic text cross-check."}</span>
          {vendor.vision.modelError ? <span className="muted"> Model note: {vendor.vision.modelError}</span> : null}
        </p>
      ) : null}
      <dl className="cage">
        <div><dt>Container</dt><dd>{vendor.containerId ? vendor.containerId.slice(0, 12) : "—"}</dd></div>
        <div><dt>Lifecycle</dt><dd>{vendor.destroyed ? "Destroyed" : vendor.containerId ? "Running" : "Not started"}</dd></div>
        <div><dt>Memory</dt><dd>{memory || "—"}</dd></div>
        <div><dt>User</dt><dd>{vendor.sandbox?.user || "pwuser"}</dd></div>
        <div><dt>Root FS</dt><dd>{vendor.sandbox?.readonlyRootfs ? "Read-only" : vendor.sandbox ? "Writable" : "—"}</dd></div>
        <div><dt>Caps</dt><dd>{vendor.sandbox?.capDrop?.includes("ALL") ? "Dropped" : vendor.sandbox ? "Check" : "—"}</dd></div>
      </dl>
      <button type="button" className="button small" onClick={() => onRequestQuote(vendor.vendorId)} disabled={vendor.status === "pending"}>
        Request a quote
      </button>
    </article>
  );
}

function liveHeadline(quote: { blocked?: boolean; lines: { unitPriceCents: number | null }[] }) {
  if (quote.blocked) return "Blocked";
  if (quote.lines.some((line) => line.unitPriceCents != null)) return "Seen on the page";
  return "No price";
}

function verificationCopy(verification?: string) {
  if (verification === "verified") return "A vision model and the page text agree on this price.";
  if (verification === "mismatch") return "A vision model did not confirm the price in the page text, so it is not verified.";
  return "Not verified by a vision model. This is only text read from the page, not a cart total.";
}

function stockWord(stock: string) {
  if (stock === "out_of_stock") return "Out of stock";
  if (stock === "not_found") return "Not listed";
  return stock;
}
