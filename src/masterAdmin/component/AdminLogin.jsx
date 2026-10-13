import { useState } from "react";
import { useNavigate } from "react-router";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { isMasterAdminIdentity } from "../../utils/adminIdentity";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const checkAdminRights = async (user) => {
    try {
      const token = await user.getIdTokenResult(true);
      const claims = token.claims || {};
      const isMaster = isMasterAdminIdentity(claims);
      if (isMaster) {
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

  return (
    <div className='flex justify-center items-center h-screen bg-gray-100'>
      <div className='bg-white p-8 rounded shadow-lg w-96'>
        <h2 className='text-2xl font-bold mb-6'>Admin Login</h2>
        {error && <p className='text-red-500 mb-4'>{error}</p>}
        <form onSubmit={handleEmailLogin}>
          <div className='mb-4'>
            <label htmlFor='admin-email' className='block text-gray-700'>Email</label>
            <input
              id='admin-email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='w-full p-2 border border-gray-300 rounded mt-1'
              required
            />
          </div>
          <div className='mb-4'>
            <label htmlFor='admin-password' className='block text-gray-700'>Password</label>
            <input
              id='admin-password'
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
      </div>
    </div>
  );
};

export default AdminLogin;
