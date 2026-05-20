// Unauthorized.js
import { useNavigate } from "react-router-dom";

const Unauthorized = () => {
  const navigate = useNavigate();

  const goBack = () => {
    navigate("/"); // Navigates back to the previous page
  };

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h1 className="text-3xl font-bold text-red-600">Unauthorized</h1>
          <p className="mt-4 text-gray-600">
            You do not have permission to view this page.
          </p>
          <div className="mt-6">
            <button
              onClick={goBack}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Unauthorized;
