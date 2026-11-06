import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="QuoteCage home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 7h13M7 7v18h18V14" fill="none" stroke="currentColor" strokeWidth="2.2" />
      </svg>
      <span>QuoteCage</span>
    </Link>
  );
}
