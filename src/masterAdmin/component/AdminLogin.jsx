import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig"; // Import from the firebaseConfig file

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const checkAdminRights = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        navigate("/foodAdmin");
      } else {
        setError("You do not have admin rights.");
      }
    } catch (error) {
      setError("Failed to verify admin rights.");
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      checkAdminRights(userCredential.user);
    } catch (error) {
      setError("Failed to sign in.");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      checkAdminRights(result.user);
    } catch (error) {
      setError("Failed to sign in with Google.");
    }
  };

  return (
    <div className='flex justify-center items-center h-screen bg-gray-100'>
      <div className='bg-white p-8 rounded shadow-lg w-96'>
        <h2 className='text-2xl font-bold mb-6'>Admin Login</h2>
        {error && <p className='text-red-500 mb-4'>{error}</p>}
        <form onSubmit={handleEmailLogin}>
          <div className='mb-4'>
            <label className='block text-gray-700'>Email</label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='w-full p-2 border border-gray-300 rounded mt-1'
              required
            />
          </div>
          <div className='mb-4'>
            <label className='block text-gray-700'>Password</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full p-2 border border-gray-300 rounded mt-1'
              required
            />
          </div>
          <button
            type='submit'
            className='w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700'>
            Sign In
          </button>
        </form>
        <button
          onClick={handleGoogleLogin}
          className='w-full bg-red-600 text-white py-2 px-4 rounded mt-4 hover:bg-red-700'>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default AdminLogin;
