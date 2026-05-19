// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA75LjefkFcJu7mV7a6gU-NMO7sG6De3W0",
  authDomain: "attendace-34039.firebaseapp.com",
  projectId: "attendace-34039",
  storageBucket: "attendace-34039.firebasestorage.app",
  messagingSenderId: "1025937538596",
  appId: "1:1025937538596:web:700d8ff148b1584db622b1",
  measurementId: "G-5PM153KZ3Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export database
export { db };