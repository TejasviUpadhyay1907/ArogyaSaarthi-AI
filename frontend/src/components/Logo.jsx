export default function Logo({ size = 42 }) {
  const id = `lg_${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Circular base */}
      <circle cx="24" cy="24" r="24" fill={`url(#${id})`} />

      {/* Outer ring — subtle */}
      <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="0.6" fill="none" opacity="0.2" />

      {/* Neural dots — AI pattern */}
      <circle cx="24" cy="8"  r="1.8" fill="white" opacity="0.5" />
      <circle cx="38" cy="16" r="1.4" fill="white" opacity="0.4" />
      <circle cx="38" cy="32" r="1.4" fill="white" opacity="0.4" />
      <circle cx="24" cy="40" r="1.8" fill="white" opacity="0.5" />
      <circle cx="10" cy="32" r="1.4" fill="white" opacity="0.4" />
      <circle cx="10" cy="16" r="1.4" fill="white" opacity="0.4" />

      {/* Neural connecting lines */}
      <line x1="24" y1="8"  x2="24" y2="14" stroke="white" strokeWidth="0.6" opacity="0.25" />
      <line x1="38" y1="16" x2="32" y2="19" stroke="white" strokeWidth="0.6" opacity="0.25" />
      <line x1="38" y1="32" x2="32" y2="29" stroke="white" strokeWidth="0.6" opacity="0.25" />
      <line x1="24" y1="40" x2="24" y2="34" stroke="white" strokeWidth="0.6" opacity="0.25" />
      <line x1="10" y1="32" x2="16" y2="29" stroke="white" strokeWidth="0.6" opacity="0.25" />
      <line x1="10" y1="16" x2="16" y2="19" stroke="white" strokeWidth="0.6" opacity="0.25" />

      {/* Medical cross — bold, centered */}
      <rect x="21" y="14" width="6" height="20" rx="3" fill="white" />
      <rect x="14" y="21" width="20" height="6" rx="3" fill="white" />

      {/* AI accent dot — teal glow */}
      <circle cx="34" cy="14" r="3.5" fill="#5EEAD4" opacity="0.95" />
      <circle cx="34" cy="14" r="1.8" fill="white" opacity="0.9" />

      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2E8B57" />
          <stop offset="0.5" stopColor="#1a7a6e" />
          <stop offset="1" stopColor="#0077B6" />
        </linearGradient>
      </defs>
    </svg>
  )
}
