// RNFB v26 ships only the modular API (the legacy `firestore()`/`auth()`
// namespaced default exports used by older RNFB versions no longer exist).
// This is the modular equivalent of the brief's
// `firestore().settings({ persistence: true, cacheSizeBytes: ... })` call,
// using the same settings values.
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from '@react-native-firebase/firestore';

const app = getApp();

const firestore = initializeFirestore(app, {
  persistence: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});

const auth = getAuth(app);

export { auth, firestore };
