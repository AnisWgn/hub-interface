// Firebase Configuration for Nexus Hub (Realtime Database)
// Replace the config below with the one from your Firebase Console

const firebaseConfig = {
    apiKey: "AIzaSyAsrYMGFve8kYeUH_7cu7zzNIFRVpUpT28",
    authDomain: "nexus-hub-b65fb.firebaseapp.com",
    projectId: "nexus-hub-b65fb",
    storageBucket: "nexus-hub-b65fb.firebasestorage.app",
    messagingSenderId: "632260168190",
    appId: "1:632260168190:web:3466f8e68b964ce9ca98af",
    databaseURL: "https://nexus-hub-b65fb-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase
// Note: L'avertissement "browser-targeted Firebase bundle" est normal dans Electron
// Firebase fonctionne correctement malgré cet avertissement
let database, appsRef;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    appsRef = database.ref('kiosk-apps');
    
    // Exposer globalement pour renderer.js
    window.database = database;
    window.appsRef = appsRef;
} catch (error) {
    console.error('Firebase initialization error:', error);
    // Créer des objets vides pour éviter les erreurs si Firebase échoue
    database = null;
    appsRef = null;
    window.database = null;
    window.appsRef = null;
}

// Connection state (optional debug)
database.ref(".info/connected").on("value", (snap) => {
    if (snap.val() === true) {
        console.log("Firebase Realtime Database: CONNECTED");
    } else {
        console.warn("Firebase Realtime Database: DISCONNECTED");
    }
});
