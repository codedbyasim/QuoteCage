import { useEffect } from "react";
import { Link } from "react-router-dom";

export function SecurityPage() {
  useEffect(() => {
    document.title = "Containment · QuoteCage";
  }, []);
  return (
    <main id="content" className="page">
      <section className="section prose">
        <p className="kicker">Blast radius</p>
        <h1>The browser is the untrusted part.</h1>
        <p>A vendor page can contain anything: a prompt telling the agent to email a customer list, a script that calls a metadata address, a file download. QuoteCage treats that page as hostile. The model that plans the list, and the model that looks at screenshots, both run on the control plane. The sandbox never receives an API key.</p>
        <h2>What each vendor run is allowed to do</h2>
        <ul>
          <li>One fresh container, destroyed when the visit ends. The lifecycle is on the run timeline.</li>
          <li>Memory, CPU, and process limits. Read-only root filesystem, capabilities dropped, no-new-privileges, user <code>pwuser</code>.</li>
          <li>Network on an internal Docker network. Browser traffic is also checked against a host allowlist. Fixture stores are on the list. <code>exfil.evil</code>, raw IP addresses, and link-local metadata addresses are not.</li>
          <li>Optional gVisor (<code>runsc</code>) when it is installed. Otherwise the engine uses <code>runc</code> and the timeline says so.</li>
        </ul>
        <h2>What still needs a person</h2>
        <p>Emailing a vendor, submitting a form, checking out, or downloading a file the page asked for stays pending until someone presses Approve or Deny. Approve records the decision and does not send anything. This MVP never places an order.</p>
        <h2>What this does not claim</h2>
        <p>The control plane can talk to the Docker socket, so it is a trusted admin surface. Chromium’s own sandbox is off inside the container because the container is the boundary. A bug in the control plane is outside the sandbox proof. Live public sites stay behind <code>ALLOW_LIVE_URLS</code> and still have to be named on the allowlist.</p>
        <p><Link to="/app">Run the office sample and watch the hostile fixture get held.</Link></p>
      </section>
    </main>
  );
}
