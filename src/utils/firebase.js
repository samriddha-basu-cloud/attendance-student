import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { collection, query, where, getDocs } from "firebase/firestore";


// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBQqI5rDTzBeooAF7y8wGeXeMHxVXL1ebA",
  authDomain: "gymi-gymi.firebaseapp.com",
  projectId: "gymi-gymi",
  storageBucket: "gymi-gymi.firebasestorage.app",
  messagingSenderId: "335109539027",
  appId: "1:335109539027:web:80ddcc0899ca6d7d28c026",
  measurementId: "G-RNXMEXGZ0N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();


// Google Login function
const signInWithGoogle = async (navigate) => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log("User email:", user.email);

    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("email", "==", user.email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      console.log("User data:", userData);
      localStorage.setItem("student", JSON.stringify(userData));

      // Navigate to /scanner upon successful login
      navigate("/scanner");
      return userData;
    } else {
      console.warn(`No document found for email: ${user.email}`);
      alert("You are not registered!");
      signOut(auth);
      return null;
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Login failed!");
  }
};

// Logout function
const logout = () => {
  signOut(auth);
  localStorage.removeItem("student");
  window.location.reload();
};

export { auth, db, signInWithGoogle, logout, setDoc, updateDoc, arrayUnion };
