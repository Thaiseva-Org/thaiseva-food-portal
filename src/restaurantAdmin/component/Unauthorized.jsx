import { useNavigate } from "react-router";

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page-gradient px-4">
      <div className="modern-card p-8 md:p-10 text-center max-w-md w-full animate-scale-in shadow-glow">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-100 text-danger-600 text-2xl">
          <i className="bi bi-shield-lock" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink-heading">
          Unauthorized
        </h1>
        <p className="mt-3 text-ink-muted">
          You do not have permission to view this page.
        </p>
        <button onClick={() => navigate("/")} className="btn-primary mt-6">
          Go back home
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
