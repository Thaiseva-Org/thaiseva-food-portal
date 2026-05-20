// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyC7fCcIT4XE4BYGQCjlQ7DpToF4J5DpOqk",
  authDomain: "gothai-ffea1.firebaseapp.com",
  projectId: "gothai-ffea1",
  storageBucket: "gothai-ffea1.firebasestorage.app",
  messagingSenderId: "46959975552",
  appId: "1:46959975552:web:e596237265563a74dc9a65",
  measurementId: "G-JJ135M38G0",
  databaseURL:
    "https://gothai-ffea1-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
export { auth };
export { db, storage };
// export { db };

// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyDvHdzKSxIRgfcFbr-B2mvqo5eh6mosd7g",
//   authDomain: "thaiseva-85cda.firebaseapp.com",
//   databaseURL: "https://thaiseva-85cda-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "thaiseva-85cda",
//   storageBucket: "thaiseva-85cda.appspot.com",
//   messagingSenderId: "113396010755",
//   appId: "1:113396010755:web:e7ead3f40909c270572336",
//   measurementId: "G-FZYNHPWP6H"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
