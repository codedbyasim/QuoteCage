# QuoteCage — slide outline

Ten slides for a three-minute conversation. Speaker notes are under each title. Do not add benchmark numbers, logos of customers, or a claim that someone has paid.

## 1. Title

QuoteCage. Which vendor is cheapest after freight?

Notes: Zoon Software. lablab.ai Vultr Agent Rush, Challenge 1, Blast Radius Zero. Pattern B: a browser, screenshots, a person.

## 2. The buyer

A small office or a print shop buys the same short list from a few suppliers.

Notes: The mess is tabs, mismatched units, and freight that shows up in the cart. We did not interview buyers this week. We are describing a job procurement tools already talk about, not a statistic we measured.

## 3. The job, in one sentence

Paste the list. Get a comparison with the pages attached. Do not contact a vendor unless a person says so.

Notes: The product is the comparison. Containment is how it is allowed to browse.

## 4. What the demo shows

Office list. Four fictional stores. One cannot fill the chairs. One is cheaper and hostile. The recommendation is the clean full quote.

Notes: Point at Oakline versus QuickQuote using the numbers from the run, not a prepared percentage.

## 5. How a run works

Plan on the control plane. One fresh browser per vendor. Screenshots and cart totals come back. A check compares the total to the page. The container is removed.

Notes: With a Vultr inference key, the planner and the screenshot check are `glm-5.3-flash` unless the env says otherwise. With no key, a deterministic normalizer and a text cross-check run, and the UI says so.

## 6. Where Vultr is

One Ubuntu VM runs the control plane, the fixture sites, and the browsers. Serverless Inference is called only from the control plane. The sandbox is a Docker container on that VM, optional gVisor.

Notes: Say the three surfaces by name: Cloud Compute, Serverless Inference, and the per-vendor sandbox. The key never enters the sandbox.

## 7. The containment moment

A fixture page tells the agent to email customer data, fetch an outside URL, and check out. The call is denied. The email waits for Deny. The container is gone.

Notes: Also say what is true underneath: read-only root, dropped capabilities, no-new-privileges, non-root, memory and pid limits, internal network plus an allowlist.

## 8. The evidence

JSON audit and a ZIP of the screenshots. Each file has a SHA-256.

Notes: This is the artifact the buyer forwards when someone asks why that vendor.

## 9. Business hypothesis

Free: 3 comparisons a month. Pro: $29 a month. RFQ pack: $9 for one comparison, up to 5 vendors.

Notes: Label it planned. No checkout in the MVP. The bet is that half a day of spreadsheet work, or one bad award, is worth more than $29. Conversion is unproven. Enterprise would later mean SSO and a stricter vendor allowlist.

## 10. What we are not claiming

Not a live-retailer scraper. Not an order placer. Not a measured savings study. Control-plane access to the Docker socket is a trusted admin surface.

Notes: Close on the recommendation still on screen.
