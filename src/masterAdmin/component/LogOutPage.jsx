import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../../firebaseConfig"; // Adjust the import based on your firebase configuration

const LogOutPage = () => {
  const navigate = useNavigate();

  const handleLogOut = async () => {
    try {
      await signOut(auth);
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out: ", error);
    }
  };

  return (
    <div className="bg-slate-200 h-[100vh] flex items-center justify-center">
      <div className="bg-white h-[20rem] w-[28rem] rounded-xl text-center p-10">
        <i className="bi bi-box-arrow-right text-5xl text-white mb-4 font-bold bg-[#ff2d2d] p-2 px-4 rounded-full"></i>
        <p className="text-3xl mt-8 mb-12">Are you sure you want to log out?</p>
        <div className="flex gap-2 items-center justify-center">
          <Link
            to="/"
            className="p-2 w-24 text-lg text-white font-semibold rounded-lg bg-slate-600"
          >
            Cancel
          </Link>
          <button
            onClick={handleLogOut}
            className="p-2 w-24 text-lg text-white font-semibold rounded-lg bg-blue-600"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogOutPage;
