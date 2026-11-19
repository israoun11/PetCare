/** PETCARE mascot "Pip": half dog, half cat, with a paw print. Used for the AI identity everywhere. */
export default function Mascot({ size = 40 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="PETCARE mascot">
    <path d="M10 14c-6 6-6 20-1 26l9-4-1-18z" fill="#405D50" /><path d="M44 8l12-4-2 20z" fill="#A7B99E" />
    <ellipse cx="32" cy="34" rx="21" ry="19" fill="#F6F3EC" stroke="#405D50" strokeWidth="2.5" />
    <path d="M44 14l9-5-1 16" fill="#A7B99E" stroke="#405D50" strokeWidth="2" />
    <circle cx="24" cy="32" r="2.6" fill="#292F2A" /><circle cx="40" cy="32" r="2.6" fill="#292F2A" />
    <path d="M28 39h8l-4 4z" fill="#405D50" /><path d="M32 43v3m-5 0c2 2 3 2 5 0 2 2 3 2 5 0" stroke="#405D50" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <g fill="#D9C6E8" stroke="#405D50" strokeWidth="1.2"><circle cx="52" cy="54" r="2.4" /><circle cx="57" cy="50" r="1.6" /><circle cx="48" cy="50" r="1.6" /></g></svg>);
}
