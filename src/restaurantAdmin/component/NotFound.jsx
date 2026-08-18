import { useNavigate } from "react-router";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page-gradient px-4">
      <div className="modern-card p-8 md:p-10 text-center max-w-md w-full animate-scale-in shadow-glow">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 text-2xl font-bold">
          404
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink-heading">
          Page not found
        </h1>
        <p className="mt-3 text-ink-muted">
          Please check the link and try again.
        </p>
        <button onClick={() => navigate("/")} className="btn-primary mt-6">
          Go back home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
