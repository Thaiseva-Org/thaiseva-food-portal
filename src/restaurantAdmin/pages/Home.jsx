import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { resolvePostLoginPath } from "../../utils/authRouting";

/**
 * Smart landing after auth:
 * - Master (backend-only) → /foodAdmin
 * - Restaurant owner without / pending / rejected app → /onboarding
 * - Verified owner → /{uid}
 */
const Home = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    document.title = "Thaiseva";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const route = async () => {
      if (loading) return;
      if (!currentUser) {
        navigate("/auth", { replace: true });
        return;
      }
      try {
        const path = await resolvePostLoginPath(currentUser);
        if (!cancelled) navigate(path, { replace: true });
      } catch (err) {
        console.error(err);
        if (!cancelled) navigate("/onboarding", { replace: true });
      }
    };

    route();
    return () => {
      cancelled = true;
    };
  }, [currentUser, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-gradient">
      <Loading />
    </div>
  );
};

export default Home;
