import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";

const Home = () => {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, isRestaurantAdmin } = useAuth();

  useEffect(() => {
    document.title = "Thaiseva";
  }, []);

  // Redirect to /auth if not logged in or to /{userId} if logged in
  useEffect(() => {
    if (!currentUser) {
      navigate("/auth");
    }

    if (isMasterAdmin) {
      navigate(`/foodAdmin`);
    } else {
      navigate(`/${currentUser?.uid}`); // Assuming uid is the user ID
    }
  }, [currentUser, navigate, isMasterAdmin, isRestaurantAdmin]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (show && !event.target.closest(".modal")) {
        setShow(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [show]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loading />
    </div>
  );
};

export default Home;
