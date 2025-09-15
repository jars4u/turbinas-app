import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDl43vMgKdjhEoRvTaRypXfB550mJodwn8",
  authDomain: "turbinas-app.firebaseapp.com",
  projectId: "turbinas-app",
  storageBucket: "turbinas-app.firebasestorage.app",
  messagingSenderId: "426432572123",
  appId: "1:426432572123:web:8649b3b0f4367de7923afe",
  measurementId: "G-NK57VGFL4M"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);