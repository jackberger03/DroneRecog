import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCzV3jdbRLoNhuSy5EZ0yshH_MG-CivZcY",
  authDomain: "scrapyard-75a01.firebaseapp.com",
  projectId: "scrapyard-75a01",
  storageBucket: "scrapyard-75a01.appspot.com",
  messagingSenderId: "572147110254",
  appId: "1:572147110254:web:3de0e6294691de92ebf17f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);