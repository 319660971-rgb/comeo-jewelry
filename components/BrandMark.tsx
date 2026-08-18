export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg className="brand-mark-symbol" viewBox="0 0 72 72">
        <path
          d="M13 13v46M13 36h24M37 13v33c0 9 5 14 13 14 7 0 11-4 11-11"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="brand-mark-node" cx="61" cy="13" r="5" strokeWidth="2" />
      </svg>
      <span className="brand-mark-word">hello jewelry</span>
    </span>
  );
}
