import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
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

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const ADMIN_EMAILS = new Set([
  'thomasfaudon@thefrenchschool.ca',
]);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const authGate = document.querySelector('#authGate');
const accessGate = document.querySelector('#accessGate');
const authStatus = document.querySelector('#authStatus');
const accountButton = document.querySelector('#accountButton');
const googleSignInButton = document.querySelector('#googleSignIn');
const accessSignOutButton = document.querySelector('#accessSignOut');
let currentUser = null;
let applyingRemote = false;
const loadedScripts = new Set();
let saveTimer;

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function status(message) {
  authStatus.textContent = message;
}

function hideAuthGate() {
  authGate.hidden = true;
  status('');
}

function showContentError(user) {
  hideAuthGate();
  document.querySelector('#accessEmail').textContent = normalizeEmail(user?.email);
  document.querySelector('#accessGate .eyebrow').textContent = 'Connexion établie';
  document.querySelector('#accessTitle').innerHTML = 'Ton accès est reconnu.<br />Le contenu n’a pas chargé.';
  document.querySelector('#accessGate .auth-copy').textContent = 'Recharge la page pour réessayer. Ta progression enregistrée ne sera pas perdue.';
  accessSignOutButton.textContent = 'Recharger la page';
  accessSignOutButton.dataset.action = 'reload';
  accessGate.hidden = false;
}

function friendlyAuthError(error) {
  if (error?.code === 'auth/popup-closed-by-user') return 'Connexion annulée.';
  if (error?.code === 'auth/unauthorized-domain') return 'Ce domaine doit être autorisé dans Firebase.';
  if (error?.code === 'auth/operation-not-allowed') return 'Cette méthode de connexion doit être activée dans Firebase.';
  return 'La connexion a échoué. Réessaie dans un instant.';
}

async function loadScript(source) {
  if (loadedScripts.has(source)) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
  loadedScripts.add(source);
}

async function getAccess(user) {
  const email = normalizeEmail(user.email);
  if (!email || user.emailVerified !== true) return null;
  if (ADMIN_EMAILS.has(email)) return { maxLevel: 'B2', courseLabel: 'Test B2' };
  const snapshot = await getDoc(doc(db, 'access', email));
  const data = snapshot.exists() ? snapshot.data() : {};
  return LEVELS.includes(data.maxLevel)
    ? { maxLevel: data.maxLevel, courseLabel: data.courseLabel || `Test ${data.maxLevel}` }
    : null;
}

async function loadAuthorizedCatalog(maxLevel) {
  const highestIndex = LEVELS.indexOf(maxLevel);
  const allowedLevels = LEVELS.slice(0, highestIndex + 1);
  const snapshots = await Promise.all(allowedLevels.map((level) => getDoc(doc(db, 'courses', level))));
  const catalog = snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => snapshot.data())
    .sort((a, b) => LEVELS.indexOf(a.id) - LEVELS.indexOf(b.id));
  if (catalog.length !== allowedLevels.length) throw new Error('Catalogue incomplet');
  window.VOCAB_CATALOG = catalog;
  return catalog;
}

function localKnownIds(setId) {
  try {
    const value = JSON.parse(localStorage.getItem(`mot-a-mot-known:${setId}`));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function preloadCourseProgress(catalog, access) {
  if (!currentUser) return;
  const course = catalog.find((item) => item.id === access.maxLevel);
  if (!course) return;
  const testAccess = /^Test (A1|A2|B1|B2)$/i.test(access.courseLabel || '');
  const sets = testAccess
    ? course.sets
    : course.sets.filter((set) => !/^Quiz\b/i.test(set.title || set.shortTitle || ''));
  const email = normalizeEmail(currentUser.email);
  await Promise.all(sets.map(async (set) => {
    const reference = doc(db, 'studentProgress', email, 'sets', set.id);
    const legacyReference = doc(db, 'users', currentUser.uid, 'progress', set.id);
    const [snapshot, legacySnapshot] = await Promise.all([getDoc(reference), getDoc(legacyReference)]);
    const merged = [...new Set([
      ...(snapshot.exists() ? snapshot.data().knownIds || [] : []),
      ...(legacySnapshot.exists() ? legacySnapshot.data().knownIds || [] : []),
      ...localKnownIds(set.id),
    ])];
    localStorage.setItem(`mot-a-mot-known:${set.id}`, JSON.stringify(merged));
  }));
}

async function loadProgress(setId) {
  if (!currentUser || !window.MotAMot || !setId) return;
  const local = window.MotAMot.getProgress();
  const email = normalizeEmail(currentUser.email);
  const reference = doc(db, 'studentProgress', email, 'sets', setId);
  const legacyReference = doc(db, 'users', currentUser.uid, 'progress', setId);
  const [snapshot, legacySnapshot] = await Promise.all([getDoc(reference), getDoc(legacyReference)]);
  const remote = snapshot.exists() ? snapshot.data() : {};
  const legacy = legacySnapshot.exists() ? legacySnapshot.data() : {};
  const knownIds = [...new Set([
    ...(remote.knownIds || []),
    ...(legacy.knownIds || []),
    ...(local.knownIds || []),
  ])];
  applyingRemote = true;
  window.MotAMot.applyProgress({ knownIds });
  applyingRemote = false;
  await setDoc(reference, { setId, knownIds, updatedAt: serverTimestamp() }, { merge: true });
}

function queueProgressSave(detail) {
  if (!currentUser || applyingRemote || !detail?.setId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const reference = doc(db, 'studentProgress', normalizeEmail(currentUser.email), 'sets', detail.setId);
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

googleSignInButton.addEventListener('click', async () => {
  status('Ouverture de Google…');
  googleSignInButton.disabled = true;
  try {
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      currentUser = result.user;
      hideAuthGate();
    }
  } catch (error) {
    if (auth.currentUser) hideAuthGate();
    else status(friendlyAuthError(error));
  } finally {
    googleSignInButton.disabled = false;
  }
});

accountButton.addEventListener('click', async () => {
  if (currentUser && window.confirm('Se déconnecter de Mot à mot ?')) {
    await signOut(auth);
    window.location.reload();
  }
});

accessSignOutButton.addEventListener('click', async () => {
  if (accessSignOutButton.dataset.action === 'reload') {
    window.location.reload();
    return;
  }
  await signOut(auth);
  window.location.reload();
});

window.addEventListener('mot-a-mot:progress', (event) => queueProgressSave(event.detail));
window.addEventListener('mot-a-mot:set-change', (event) => loadProgress(event.detail.setId));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  authGate.hidden = Boolean(user);
  accessGate.hidden = true;
  accountButton.hidden = !user;
  if (!user) {
    status('');
    return;
  }

  hideAuthGate();

  const label = user.displayName || user.email || 'Mon compte';
  document.querySelector('#accountName').textContent = label;
  document.querySelector('#accountAvatar').textContent = label.slice(0, 1).toUpperCase();
  try {
    await setDoc(doc(db, 'users', user.uid), {
      displayName: user.displayName || '',
      email: normalizeEmail(user.email),
      lastSeenAt: serverTimestamp(),
    }, { merge: true });
    const access = await getAccess(user);
    if (!access) {
      document.querySelector('#accessEmail').textContent = normalizeEmail(user.email);
      accessGate.hidden = false;
      return;
    }
    window.MOT_A_MOT_ACCESS = access;
    const catalog = await loadAuthorizedCatalog(access.maxLevel);
    await preloadCourseProgress(catalog, access);
    await loadScript('course-schedule.js?v=1');
    await loadScript('app.js?v=26');
    await loadProgress(window.MotAMot.getProgress().setId);
  } catch (error) {
    console.error(error);
    window.MotAMot?.notify('Connexion établie, mais le contenu n’a pas pu être chargé. Réessaie en ligne.');
    if (!window.MotAMot) showContentError(user);
  }
});
