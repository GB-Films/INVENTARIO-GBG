const STORAGE_KEY = 'gbg-inventory-state'
const FIREBASE_VERSION = '12.12.1'

const firebaseConfig = {
  apiKey: 'AIzaSyAo45MIxiDvgbt-dj_MzScwxX32chyzdcI',
  authDomain: 'gran-berta-films.firebaseapp.com',
  projectId: 'gran-berta-films',
  firestoreDatabaseId: 'ai-studio-1ef504c9-77ed-4378-b361-4b3659b5d837',
  storageBucket: 'gran-berta-films.firebasestorage.app',
  messagingSenderId: '2075408694',
  appId: '1:2075408694:web:0e47048a0e27aee8df9b97',
}

const firebaseCloudUser = {
  email: 'banivfx@granbertavault.com',
  password: 'banivfx_secure_vault',
}

let firebaseApiPromise = null
let firebaseUserPromise = null

export const isCloudStorageEnabled = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

const loadFirebaseApi = async () => {
  if (firebaseApiPromise) return firebaseApiPromise

  firebaseApiPromise = Promise.all([
    import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
  ]).then(([appModule, authModule, firestoreModule]) => {
    const app = appModule.getApps().length ? appModule.getApps()[0] : appModule.initializeApp(firebaseConfig)
    return {
      auth: authModule.getAuth(app),
      createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
      db: firestoreModule.getFirestore(app, firebaseConfig.firestoreDatabaseId),
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      setDoc: firestoreModule.setDoc,
      signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    }
  })

  return firebaseApiPromise
}

const signInToFirebase = async () => {
  const api = await loadFirebaseApi()
  if (api.auth.currentUser) return { api, user: api.auth.currentUser }

  if (!firebaseUserPromise) {
    firebaseUserPromise = api.signInWithEmailAndPassword(api.auth, firebaseCloudUser.email, firebaseCloudUser.password)
      .catch(async (error) => {
        if (['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error?.code)) {
          return api.createUserWithEmailAndPassword(api.auth, firebaseCloudUser.email, firebaseCloudUser.password)
        }
        throw error
      })
  }

  const credential = await firebaseUserPromise
  return { api, user: credential.user }
}

const inventoryDocRef = (api, user) => api.doc(api.db, 'users', user.uid, 'apps', 'inventario-gbg')

const loadCloudValue = async (key, fallback) => {
  if (!isCloudStorageEnabled()) return fallback
  const { api, user } = await signInToFirebase()
  const snapshot = await api.getDoc(inventoryDocRef(api, user))
  if (!snapshot.exists()) return fallback
  return snapshot.data()?.data ?? fallback
}

const saveCloudValue = async (key, value) => {
  if (!isCloudStorageEnabled()) return
  const { api, user } = await signInToFirebase()
  await api.setDoc(inventoryDocRef(api, user), {
    app: 'inventario-gbg',
    data: value,
    key,
    updatedAt: new Date().toISOString(),
  }, {
    merge: true,
  })
}

export const loadInventoryState = (fallback) => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? fallback
  } catch {
    return fallback
  }
}

export const saveInventoryState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const loadSharedInventoryState = () => loadCloudValue(STORAGE_KEY, null)
export const saveSharedInventoryState = (state) => saveCloudValue(STORAGE_KEY, state)
