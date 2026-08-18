const NavBadge = ({ count }) => {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold tabular-nums leading-none text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
};

export default NavBadge;
