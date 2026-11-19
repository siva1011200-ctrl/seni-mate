export default function Logo({ dark = false }) {
  return (
    <svg
      className="logo-svg"
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="32" height="32" rx="8" fill={dark ? '#1B59D6' : '#0B2559'} />
      <path d="M10 12h14v3.2h-5.4v11h-3.2v-11H10z" fill="#fff" />
      <circle cx="25" cy="23.5" r="4.5" fill="#fff" opacity="0.92" />
      <path d="M23.4 23.5l1.1 1.1 2-2.2" stroke="#0B2559" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
