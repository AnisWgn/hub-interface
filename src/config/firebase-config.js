// Firebase Configuration for Nexus Hub
// Replace the config object below with the one from your Firebase Console

const firebaseConfig = {
    apiKey: "AIzaSyAsrYMGFve8kYeUH_7cu7zzNIFRVpUpT28",
    authDomain: "nexus-hub-b65fb.firebaseapp.com",
    projectId: "nexus-hub-b65fb",
    storageBucket: "nexus-hub-b65fb.firebasestorage.app",
    messagingSenderId: "632260168190",
    appId: "1:632260168190:web:3466f8e68b964ce9ca98af",
    databaseURL: "https://nexus-hub-b65fb-default-rtdb.europe-west1.firebasedatabase.app" // Vérifiez cette URL dans l'onglet Realtime Database
};

// Initialize Firebase (using version 8 compatibility for simplicity in browser script)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const appsRef = database.ref('kiosk-apps');
