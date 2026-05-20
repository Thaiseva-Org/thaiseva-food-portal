import { useContext, createContext, useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { useMemo } from "react";

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    currentUser: null,
    roleData: null,
    resData: null,
    isMasterAdmin: false,
    isRestaurantAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Fetch role data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let roleData = null;
        let isMasterAdmin = false;
        let isRestaurantAdmin = false;
        let resData = false;
        if (userDoc.exists()) {
          roleData = userDoc.data();
          if (roleData.role === "Admin" || roleData.isMasterAdmin === true) {
            isMasterAdmin = true;
          }
          if (roleData.isRestaurantAdmin === true) {
            isRestaurantAdmin = true;
          }
        }
        if (isRestaurantAdmin) {
          const resDoc = await getDoc(doc(db, "restaurants", user.uid));
          if (resDoc.exists()) {
            resData = resDoc.data();
          }
        }
        setAuthState({
          currentUser: user,
          roleData,
          resData,
          isMasterAdmin,
          isRestaurantAdmin,
          loading: false,
        });
      } else {
        setAuthState({
          currentUser: null,
          roleData: null,
          isMasterAdmin: false,
          isRestaurantAdmin: false,
          loading: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const contextValue = useMemo(
    () => ({
      currentUser: authState.currentUser,
      authState: authState.authState,
      roleData: authState.roleData,
      resData: authState.resData,
      isMasterAdmin: authState.isMasterAdmin,
      isRestaurantAdmin: authState.isRestaurantAdmin,
      loading: authState.loading,
    }),
    [authState]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {!authState.loading && children}
    </AuthContext.Provider>
  );
};
