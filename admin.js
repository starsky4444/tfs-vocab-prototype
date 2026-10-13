import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  getFirestore, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const firebaseConfig = {
  projectId: 'tfs-vocab-2026',
  appId: '1:717623955570:web:d418aa28f94274a8ccf2eb',
  storageBucket: 'tfs-vocab-2026.firebasestorage.app',
  apiKey: 'AIzaSyAttb9lFvjhGg0j48qsPqplsPp2dUCE-Xw',
  authDomain: 'tfs-vocab-2026.firebaseapp.com',
  messagingSenderId: '717623955570',
};
const ADMIN_EMAILS = new Set([
  'thomasfaudon@thefrenchschool.ca',
]);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const gate = document.querySelector('#adminGate');
const gateStatus = document.querySelector('#adminGateStatus');
const status = document.querySelector('#adminStatus');
const account = document.querySelector('#adminAccount');
let courseOptions = [];
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const courseCache = new Map();

function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

function isAdmin(user) {
  return user?.emailVerified === true && ADMIN_EMAILS.has(normalizeEmail(user.email));
}

async function renderAccessList() {
  const list = document.querySelector('#accessList');
  const snapshot = await getDocs(query(collection(db, 'access'), orderBy('email')));
  if (snapshot.empty) {
    list.textContent = 'Aucun accès étudiant attribué pour le moment.';
    return;
  }
  list.replaceChildren(...snapshot.docs.map((item) => {
    const data = item.data();
    const row = document.createElement('form');
    row.className = 'access-row';
    const email = document.createElement('span');
    email.textContent = data.email;
    const course = document.createElement('select');
    course.setAttribute('aria-label', `Cours de ${data.email}`);
    course.append(...courseOptions.map(({ label }) => {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      option.selected = label === data.courseLabel;
      return option;
    }));
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Valider';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-access';
    remove.textContent = 'Supprimer';
    row.addEventListener('submit', async (event) => {
      event.preventDefault();
      save.disabled = true;
      try {
        await saveAccess(data.email, course.value);
        status.textContent = `Cours de ${data.email} modifié : ${data.courseLabel || 'ancien accès'} → ${course.value}.`;
        await renderAccessList();
      } catch {
        status.textContent = `Impossible de modifier l’accès de ${data.email}.`;
      } finally {
        save.disabled = false;
      }
    });
    remove.addEventListener('click', async () => {
      const confirmed = window.confirm(`Supprimer l’accès de ${data.email} ?\n\nSon historique de progression sera conservé.`);
      if (!confirmed) return;
      save.disabled = true;
      remove.disabled = true;
      try {
        await deleteDoc(doc(db, 'access', data.email));
        status.textContent = `Accès supprimé pour ${data.email}. Son historique est conservé.`;
        await renderAccessList();
      } catch {
        status.textContent = `Impossible de supprimer l’accès de ${data.email}.`;
        save.disabled = false;
        remove.disabled = false;
      }
    });
    row.append(email, course, save, remove);
    return row;
  }));
}

async function loadCourseOptions() {
  const snapshot = await getDoc(doc(db, 'config', 'courseOptions'));
  const courses = snapshot.exists() ? snapshot.data().courses : [];
  courseOptions = Array.isArray(courses)
    ? courses.filter((item) => item && typeof item.label === 'string' && ['A1', 'A2', 'B1', 'B2'].includes(item.level))
    : [];
  if (!courseOptions.length) throw new Error('Aucun cours disponible');
  const selector = document.querySelector('#courseChoice');
  selector.replaceChildren(...courseOptions.map(({ label }) => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    return option;
  }));
}

async function saveAccess(email, courseLabel) {
  const selectedCourse = courseOptions.find((item) => item.label === courseLabel);
  if (!selectedCourse) throw new Error('Cours invalide');
  await setDoc(doc(db, 'access', email), {
    email,
    courseLabel,
    maxLevel: selectedCourse.level,
    updatedAt: serverTimestamp(),
    updatedBy: normalizeEmail(auth.currentUser?.email),
  }, { merge: true });
}

function isVocabularySet(set) {
  return !/^Quiz\b/i.test(set?.title || set?.shortTitle || '');
}

async function loadEditorCourse(level, force = false) {
  if (!force && courseCache.has(level)) return courseCache.get(level);
  const snapshot = await getDoc(doc(db, 'courses', level));
  if (!snapshot.exists()) throw new Error('Niveau introuvable');
  const course = snapshot.data();
  courseCache.set(level, course);
  return course;
}

async function renderEditorSets() {
  const level = document.querySelector('#editorLevel').value;
  const course = await loadEditorCourse(level);
  const sets = (course.sets || []).filter(isVocabularySet);
  const selector = document.querySelector('#editorSet');
  selector.replaceChildren(...sets.map((set) => new Option(`${set.shortTitle} · ${(set.cards || []).length} cartes`, set.id)));
  await renderCardEditor();
}

async function saveCardEdit(level, setId, cardId, values) {
  const reference = doc(db, 'courses', level);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('Niveau introuvable');
    const course = snapshot.data();
    const set = (course.sets || []).find((item) => item.id === setId);
    const card = (set?.cards || []).find((item) => String(item.id) === String(cardId));
    if (!card) throw new Error('Carte introuvable');
    card.fr = values.fr.trim();
    card.en = values.en.trim();
    card.note = values.note.trim();
    if (!card.fr || !card.en) throw new Error('Texte obligatoire');
    transaction.set(reference, course);
  });
  const readback = await getDoc(reference);
  const saved = readback.data()?.sets?.find((item) => item.id === setId)?.cards?.find((item) => String(item.id) === String(cardId));
  if (!saved || saved.fr !== values.fr.trim() || saved.en !== values.en.trim() || (saved.note || '') !== values.note.trim()) {
    throw new Error('Vérification impossible');
  }
  courseCache.set(level, readback.data());
}

async function renderCardEditor() {
  const level = document.querySelector('#editorLevel').value;
  const setId = document.querySelector('#editorSet').value;
  const list = document.querySelector('#cardEditorList');
  const editorStatus = document.querySelector('#editorStatus');
  const course = await loadEditorCourse(level);
  const set = (course.sets || []).find((item) => item.id === setId);
  if (!set) {
    list.textContent = 'Aucun set de vocabulaire pour ce niveau.';
    return;
  }
  list.replaceChildren(...(set.cards || []).map((card, index) => {
    const row = document.createElement('form');
    row.className = 'card-editor-row';
    const identity = document.createElement('span');
    identity.className = 'card-editor-id';
    identity.textContent = `Carte ${index + 1} · ${card.id}`;
    const fr = document.createElement('textarea');
    fr.value = card.fr || '';
    fr.setAttribute('aria-label', `Français, carte ${index + 1}`);
    const en = document.createElement('textarea');
    en.value = card.en || '';
    en.setAttribute('aria-label', `Anglais, carte ${index + 1}`);
    const note = document.createElement('textarea');
    note.value = card.note || '';
    note.placeholder = 'Note facultative';
    note.setAttribute('aria-label', `Note, carte ${index + 1}`);
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Enregistrer';
    row.addEventListener('submit', async (event) => {
      event.preventDefault();
      save.disabled = true;
      editorStatus.textContent = `Enregistrement de la carte ${index + 1}…`;
      try {
        await saveCardEdit(level, setId, card.id, { fr: fr.value, en: en.value, note: note.value });
        editorStatus.textContent = `Carte ${index + 1} enregistrée et vérifiée.`;
      } catch {
        editorStatus.textContent = `Impossible d’enregistrer la carte ${index + 1}.`;
      } finally {
        save.disabled = false;
      }
    });
    row.append(identity, fr, en, note, save);
    return row;
  }));
}

async function initializeCardEditor() {
  const level = document.querySelector('#editorLevel');
  level.replaceChildren(...LEVELS.map((item) => new Option(item, item)));
  level.addEventListener('change', renderEditorSets);
  document.querySelector('#editorSet').addEventListener('change', renderCardEditor);
  await renderEditorSets();
}

document.querySelector('#adminSignIn').addEventListener('click', async () => {
  gateStatus.textContent = 'Ouverture de Google…';
  try { await signInWithPopup(auth, provider); } catch { gateStatus.textContent = 'Connexion annulée ou impossible.'; }
});

account.addEventListener('click', async () => {
  if (window.confirm('Se déconnecter de l’administration ?')) await signOut(auth);
});

document.querySelector('#accessForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = normalizeEmail(document.querySelector('#studentEmail').value);
  const courseLabel = document.querySelector('#courseChoice').value;
  if (!email || !courseOptions.some((item) => item.label === courseLabel)) return;
  status.textContent = 'Activation en cours…';
  try {
    const selectedCourse = courseOptions.find((item) => item.label === courseLabel);
    await saveAccess(email, courseLabel);
    status.textContent = `Accès ${courseLabel} activé pour ${email}. Les contenus jusqu’au niveau ${selectedCourse.level} sont inclus.`;
    document.querySelector('#studentEmail').value = '';
    await renderAccessList();
  } catch {
    status.textContent = 'L’accès n’a pas pu être enregistré.';
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    gate.hidden = false;
    account.hidden = true;
    return;
  }
  if (!isAdmin(user)) {
    gate.hidden = false;
    gateStatus.textContent = 'Ce compte n’est pas autorisé à gérer les accès.';
    await signOut(auth);
    return;
  }
  gate.hidden = true;
  account.hidden = false;
  const label = user.displayName || user.email;
  document.querySelector('#adminName').textContent = label;
  document.querySelector('#adminAvatar').textContent = label.slice(0, 1).toUpperCase();
  try {
    await loadCourseOptions();
    await renderAccessList();
    await initializeCardEditor();
  } catch {
    status.textContent = 'Impossible de charger les cours ou les accès actuels.';
  }
});
