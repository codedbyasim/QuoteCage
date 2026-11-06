import type { VendorView } from "../types";

export function ScreenshotReel({ vendors }: { vendors: VendorView[] }) {
  const shots = vendors.flatMap((vendor) => vendor.screenshots.map((shot) => ({ ...shot, vendor: vendor.name })));
  if (shots.length === 0) return null;
  return (
    <section className="reel">
      <div className="section-head">
        <p className="kicker">Evidence</p>
        <h2>Pages the sandbox actually opened</h2>
      </div>
      <div className="reel-row" tabIndex={0} aria-label="Screenshot reel">
        {shots.map((shot) => (
          <figure key={`${shot.vendor}-${shot.filename}`}>
            <img src={shot.url} alt={`${shot.vendor}: ${shot.label}`} />
            <figcaption>
              <span>{shot.vendor}</span>
              <span>{shot.label}</span>
              <code>{shot.sha256.slice(0, 12)}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
