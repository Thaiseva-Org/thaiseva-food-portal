const Loading = () => {
  return (
    <div
      className="h-16 w-28 mx-auto flex items-center justify-center gap-2"
      role="status"
      aria-label="Loading"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-3 w-3 rounded-full bg-brand-500 animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
};

export default Loading;
