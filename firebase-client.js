import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

if (window.location.hostname === 'starsky4444.github.io') {
  window.location.replace(`https://tfs-vocab-2026.web.app${window.location.pathname.replace('/tfs-vocab-prototype', '')}${window.location.search}${window.location.hash}`);
}

const firebaseConfig = {
  projectId: 'tfs-vocab-2026',
  appId: '1:717623955570:web:d418aa28f94274a8ccf2eb',
  storageBucket: 'tfs-vocab-2026.firebasestorage.app',
  apiKey: 'AIzaSyAttb9lFvjhGg0j48qsPqplsPp2dUCE-Xw',
  authDomain: 'tfs-vocab-2026.firebaseapp.com',
  messagingSenderId: '717623955570',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const authGate = document.querySelector('#authGate');
const authStatus = document.querySelector('#authStatus');
const accountButton = document.querySelector('#accountButton');
let currentUser = null;
let applyingRemote = false;
let saveTimer;

function status(message) {
  authStatus.textContent = message;
}

function friendlyAuthError(error) {
  if (error?.code === 'auth/popup-closed-by-user') return 'Connexion annulée.';
  if (error?.code === 'auth/unauthorized-domain') return 'Ce domaine doit être autorisé dans Firebase.';
  if (error?.code === 'auth/operation-not-allowed') return 'Cette méthode de connexion doit être activée dans Firebase.';
  return 'La connexion a échoué. Réessaie dans un instant.';
}

async function loadProgress(setId) {
  if (!currentUser || !window.MotAMot) return;
  const local = window.MotAMot.getProgress();
  const reference = doc(db, 'users', currentUser.uid, 'progress', setId);
  const snapshot = await getDoc(reference);
  const remote = snapshot.exists() ? snapshot.data() : {};
  const knownIds = [...new Set([...(remote.knownIds || []), ...(local.knownIds || [])])];
  applyingRemote = true;
  window.MotAMot.applyProgress({ knownIds });
  applyingRemote = false;
  await setDoc(reference, { setId, knownIds, updatedAt: serverTimestamp() }, { merge: true });
}

function queueProgressSave(detail) {
  if (!currentUser || applyingRemote || !detail?.setId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const reference = doc(db, 'users', currentUser.uid, 'progress', detail.setId);
    try {
      await setDoc(reference, {
        setId: detail.setId,
        knownIds: detail.knownIds || [],
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch {
      window.MotAMot?.notify('Progression conservée hors ligne. Elle sera synchronisée plus tard.');
    }
  }, 350);
}

document.querySelector('#googleSignIn').addEventListener('click', async () => {
  status('Ouverture de Google…');
  try { await signInWithPopup(auth, provider); } catch (error) { status(friendlyAuthError(error)); }
});

document.querySelector('#emailSignInForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#emailSignIn').value.trim();
  if (!email) return;
  status('Envoi du lien de connexion…');
  try {
    await sendSignInLinkToEmail(auth, email, {
      url: `${window.location.origin}${window.location.pathname}`,
      handleCodeInApp: true,
    });
    localStorage.setItem('mot-a-mot-email-for-sign-in', email);
    status('Lien envoyé. Ouvre-le sur cet appareil pour te connecter.');
  } catch (error) {
    status(friendlyAuthError(error));
  }
});

accountButton.addEventListener('click', async () => {
  if (currentUser && window.confirm('Se déconnecter de Mot à mot ?')) await signOut(auth);
});

window.addEventListener('mot-a-mot:progress', (event) => queueProgressSave(event.detail));
window.addEventListener('mot-a-mot:set-change', (event) => loadProgress(event.detail.setId));

if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = localStorage.getItem('mot-a-mot-email-for-sign-in');
  if (!email) email = window.prompt('Confirme ton adresse courriel pour terminer la connexion :');
  if (email) {
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => {
        localStorage.removeItem('mot-a-mot-email-for-sign-in');
        history.replaceState({}, document.title, window.location.pathname);
      })
      .catch((error) => status(friendlyAuthError(error)));
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  authGate.hidden = Boolean(user);
  accountButton.hidden = !user;
  if (!user) {
    status('');
    return;
  }
  const label = user.displayName || user.email || 'Mon compte';
  document.querySelector('#accountName').textContent = label;
  document.querySelector('#accountAvatar').textContent = label.slice(0, 1).toUpperCase();
  try {
    await setDoc(doc(db, 'users', user.uid), {
      displayName: user.displayName || '',
      email: user.email || '',
      lastSeenAt: serverTimestamp(),
    }, { merge: true });
    await loadProgress(window.MotAMot.getProgress().setId);
  } catch {
    window.MotAMot?.notify('Connecté. La synchronisation reprendra dès que le réseau sera disponible.');
  }
});
