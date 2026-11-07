import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <Logo />
      <nav id="site-nav" className={open ? "open" : ""} onClick={() => setOpen(false)}>
        <NavLink to="/app">Compare</NavLink>
        <NavLink to="/security">Containment</NavLink>
        <NavLink to="/pricing">Pricing</NavLink>
      </nav>
      <div className="top-actions">
        <NavLink className="nav-cta" to="/app">New comparison</NavLink>
        <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
    </header>
  );
}
