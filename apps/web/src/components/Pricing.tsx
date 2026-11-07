import { useEffect } from "react";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "planned",
    detail: "For a buyer trying the workflow.",
    points: ["3 comparisons a month", "Public stores on an allowlist", "Audit JSON"],
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "per month, planned",
    detail: "For someone who sources the same list often.",
    points: ["Comparisons through the month", "Evidence ZIP with screenshots", "Team seats are a later idea"],
    featured: true,
  },
  {
    name: "RFQ pack",
    price: "$9",
    cadence: "planned",
    detail: "For one buying decision.",
    points: ["A single comparison", "Up to 5 vendors", "The evidence pack for that decision"],
  },
];

export function Pricing({ heading = "Planned pricing" }: { heading?: string }) {
  return (
    <section className="section" id="pricing">
      <div className="section-head">
        <p className="kicker">Hypothesis</p>
        <h2>{heading}</h2>
        <p>These prices are a starting hypothesis for small-business buyers, not a live checkout. Nothing on this page charges a card. Conversion is unproven, and fixture demos are not the same as live storefronts.</p>
      </div>
      <div className="tiers">
        {TIERS.map((tier) => (
          <article key={tier.name} className={tier.featured ? "tier featured" : "tier"}>
            <h3>{tier.name}</h3>
            <p className="price">{tier.price}</p>
            <p className="cadence">{tier.cadence}</p>
            <p>{tier.detail}</p>
            <ul>
              {tier.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <p className="planned">No payment in this MVP.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PricingPage() {
  useEffect(() => {
    document.title = "Pricing · QuoteCage";
  }, []);
  return (
    <main id="content" className="page">
      <Pricing heading="What a buyer might pay" />
      <section className="section prose">
        <h2>Who it is for</h2>
        <p>The paying customer we have in mind is an operations manager, a small manufacturer, or an agency that sources print and packaging. The reason to pay is ordinary: half a day in spreadsheets, or one award that ignored freight, already costs more than a $29 month. An audit trail for “why this vendor” is the extra.</p>
        <p>How we would reach them, if this left the hackathon: a product-led demo, search around vendor quote comparison, and direct outreach to sellers and print shops. That plan is untested. We have not run interviews this week, and we are not claiming a measured savings rate.</p>
      </section>
    </main>
  );
}
