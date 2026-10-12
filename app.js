const DEFAULT_TSV = `ça va ?, comment ça va ?\thow are you?
pas mal, pas pire (Qc)\tnot bad
et toi ?, et vous ?\tand you? Friendly and formal
Comment dit-on ... en français ?\tHow do we say ... in French?
Ça veut dire quoi ... ?\tWhat does it mean?
Comment tu t'appelles ? C'est quoi ton nom ?\tWhat's your name? Friendly
Comment vous vous appelez ? Quel est votre nom ?\tWhat's your name? Formal or plural
Je m'appelle ... , Moi c'est ...\tMy name is
Peux-tu répéter ? Pouvez-vous répéter ?\tCould you repeat?
enchanté, enchantée / pareillement\tnice to meet you / likewise
Comment ça s'écrit ?\tHow does it spell?
mon prénom / mon nom de famille\tmy first name / my last name
V comme Valérie\tV like Valery
Tu viens d'où ? Vous venez d'où ?\tWhere are you from?
Je suis Canadien, Canadienne\tI'm from Canada.
J'habite à Montréal.\tI live in Montreal.
Je parle anglais / Je ne parle pas français.\tI speak English / I don't speak French
J'apprends le français pour ... la vie à Montréal / le travail / la famille\tI'm learning French in order to/for ... life in Montreal / work / family
oui / ouais / non\tyes / yeah / no
peut-être / bien sûr\tmaybe / of course
Je suis d'accord.\tI agree.
Je comprends.\tI understand
mais / et / si\tbut / and / if
pourquoi ? / parce que\twhy? / because
madame / monsieur\tma'am / sir
Salut ! (also bye), allô ! (Qc, also on the phone)\thi! Casual
bonjour / bonne journée\thi / have a good day
bon après-midi\tHave a good afternoon
bonsoir / bonne soirée\tgood evening / have a good evening
bonne nuit\tsleep well
au revoir / à la prochaine\tgoodbye / see you next time
à bientôt / à demain\tsee you soon / see you tomorrow
s'il te plaît, s'il vous plaît / merci\tplease / thanks
bienvenue (Québec), pas de quoi, de rien\tyou're welcome
désolé(e), pardon, excuse-moi, excusez-moi\tsorry
Tu viens d'où? Tu es d'où?/Vous venez d'où? Vous êtes d'où?\tWhere are you from?
un pays, une province, un État, une ville\ta country, a province, a State, a city
le Sud, le Nord, l'Est, l'Ouest\tsouth, north, east, west
l'Allemagne, allemand, allemande\tGermany, German
l'Angleterre, anglais, anglaise\tEngland, English
l'Australie, australien, australienne\tAustralia, Australian
le Brésil, brésilien, brésilienne\tBrazil, Brazilian
le Canada, canadien, canadienne\tCanada, Canadian
la Chine, chinois, chinoise\tChina, Chinese
les États-Unis, américain, américaine\tUnited States, American
la France, français, française\tFrance, French
l'Inde, indien, indienne\tIndia, Indian
l'Italie, italien, italienne\tItaly, Italian
le Japon, japonais, japonaise\tJapan, Japanese
le Mexique, mexicain, mexicaine\tMexico, Mexican
le Nigéria, nigérian, nigériane\tNigeria, Nigerian
les Philippines, philippin, philippine\tPhilippines, Filipino, Filipina
le Québec, québécois, québécoise\tQuebec, Quebecker
la Russie, russe\tRussia, Russian
l'Ukraine, ukrainien, ukrainienne\tUkraine, Ukrainian
Tu fais quoi dans la vie?, C'est quoi ta job (casual)? / Vous faites quoi dans la vie?\tWhat do you do for a living?
un travail, un contrat, un salaire\ta job, contract, a salary
Je ne travaille pas pour le moment.\tI am not working at the moment.
en télétravail, au bureau\tremote work, at the office
étudiant, étudiante\tstudent
médecin, docteur, docteure\tdoctor
infirmier, infirmière / pharmacien, pharmacienne\tnurse / pharmacist
professeur, professeure, enseignant, enseignante\tteacher
ingénieur, ingénieure\tengineer
je travaille en T.I.\tI work in IT
avocat, avocate\tlawyer, avocado (masc.)
serveur, serveuse / vendeur, vendeuse\twaiter, waitress / person who works in sales
acteur, actrice / chanteur, chanteuse\tactor / singer
développeur, développeuse / graphiste\tdeveloper / graphic designer
directeur, directrice / adjoint, adjointe\tdirector, manager / assistant`;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

function parseTsv(input) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [fr, ...englishParts] = line.split('\t');
    let en = englishParts.join('\t').trim();
    if (!fr?.trim() || !en) return null;
    let note = '';
    const noteMatch = en.match(/\s+(Friendly and formal|Friendly|Formal or plural|Casual)$/i);
    if (noteMatch) {
      note = noteMatch[1];
      en = en.slice(0, noteMatch.index).trim();
    }
    return { id: `${index}-${slug(fr)}`, fr: fr.trim(), en, note };
  }).filter(Boolean);
}

function slug(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CATALOG = window.VOCAB_CATALOG || [];
const ALL_SETS = CATALOG.flatMap((course) => course.sets.map((set) => ({ ...set, courseId: course.id })));
const DEFAULT_SET = ALL_SETS[0] || {
  id: 'legacy-set', courseId: 'A1', shortTitle: 'Vocabulaire', title: 'Vocabulaire',
  description: '', goalStartDate: '2026-10-11', tsv: DEFAULT_TSV,
};
let activeSet = ALL_SETS.find((set) => set.id === storage.get('mot-a-mot-active-set', DEFAULT_SET.id)) || DEFAULT_SET;
let browsedCourseId = activeSet.courseId;

function customCardsKey(setId = activeSet.id) { return `mot-a-mot-custom-cards:${setId}`; }
function knownCardsKey(setId = activeSet.id) { return `mot-a-mot-known:${setId}`; }
function cardsForSet(set = activeSet) { return storage.get(customCardsKey(set.id), null) || parseTsv(set.tsv); }

let cards = cardsForSet();
let deck = [...cards];
let cardIndex = 0;
let revealed = false;
const legacyKnown = activeSet.id === DEFAULT_SET.id ? storage.get('mot-a-mot-known', []) : [];
let known = new Set(storage.get(knownCardsKey(), legacyKnown));
let playSessionActive = false;
let playRunning = false;
let playTimer;
let studyFilter = 'all';
let quiz = null;
let studyDirection = storage.get('mot-a-mot-direction', 'en-fr');
let showBothLanguages = storage.get('mot-a-mot-show-both-languages', true) !== false;
let shuffleEnabled = storage.get('mot-a-mot-shuffle-enabled', false) === true;
const savedAutoSound = storage.get('mot-a-mot-auto-sound', {});
let autoSound = { fr: savedAutoSound.fr !== false, en: savedAutoSound.en !== false };
let autoSpeakTimer;
const CARDS_PER_DAY = 10;
const PLAY_DELAY_MS = 5000;

function cleanForSpeech(text) {
  return text
    .replace(/\((?:Qc|Québec|casual|also[^)]*)\)/gi, '')
    .replace(/\.{3}/g, ' ')
    .replace(/\s*\/\s*/g, '. ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreVoice(voice, language) {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  let score = 0;
  if (language.startsWith('en')) {
    if (lang === 'en-us') score += 45;
    else if (lang === 'en-ca') score += 40;
    else if (lang === 'en-gb') score += 30;
    else if (lang.startsWith('en')) score += 20;
    if (/natural|premium|enhanced/.test(name)) score += 60;
    if (/samantha|ava|allison|aaron|google us english|aria|jenny|guy/.test(name)) score += 50;
    if (/compact|eloquence|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/.test(name)) score -= 80;
  } else {
    if (lang === 'fr-ca') score += 45;
    else if (lang === 'fr-fr') score += 35;
    else if (lang.startsWith('fr')) score += 20;
    if (/natural|premium|enhanced|amelie|thomas|audrey|google français/.test(name)) score += 45;
    if (/compact|eloquence/.test(name)) score -= 80;
  }
  if (voice.default) score += 5;
  return score;
}

function bestVoice(language) {
  const family = language.slice(0, 2).toLowerCase();
  return speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith(family))
    .sort((a, b) => scoreVoice(b, language) - scoreVoice(a, language))[0] || null;
}

function speak(text, language, rate = 0.92) {
  if (!('speechSynthesis' in window)) return toast('Audio non disponible sur ce navigateur.');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
  utterance.lang = language;
  utterance.rate = rate;
  utterance.voice = bestVoice(language);
  speechSynthesis.speak(utterance);
}

function maybeSpeak(text, language, delay = 160) {
  const key = language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  if (!autoSound[key]) return;
  clearTimeout(autoSpeakTimer);
  autoSpeakTimer = setTimeout(() => speak(text, language), delay);
}

function updateAutoSoundControls() {
  $('#autoSoundFrench').checked = autoSound.fr;
  $('#autoSoundEnglish').checked = autoSound.en;
  storage.set('mot-a-mot-auto-sound', autoSound);
}

function setAutoSound(language, enabled) {
  autoSound = { ...autoSound, [language]: enabled };
  clearTimeout(autoSpeakTimer);
  if (!enabled && 'speechSynthesis' in window) speechSynthesis.cancel();
  updateAutoSoundControls();
  toast(`Son automatique ${language.toUpperCase()} ${enabled ? 'activé' : 'désactivé'}.`);
}

function updateKnownCount() {
  $('#knownCount').textContent = known.size;
  const today = new Date();
  const todayNumber = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [startYear, startMonth, startDay] = activeSet.goalStartDate.split('-').map(Number);
  const startNumber = Date.UTC(startYear, startMonth - 1, startDay);
  const elapsedDays = Math.floor((todayNumber - startNumber) / 86400000);
  const goal = Math.min(cards.length, Math.max(0, elapsedDays + 1) * CARDS_PER_DAY);
  $('#dailyGoal').textContent = goal;
  const goalProgress = $('#goalProgress');
  goalProgress.classList.toggle('met', known.size >= goal);
  goalProgress.classList.toggle('behind', known.size < goal);
  storage.set(knownCardsKey(), [...known]);
  updateFilterButton();
  renderCatalog();
}

function cardsForFilter(filter = studyFilter) {
  if (filter === 'unknown') return cards.filter((card) => !known.has(card.id));
  if (filter === 'known') return cards.filter((card) => known.has(card.id));
  return [...cards];
}

function buildDeck() {
  const filteredCards = cardsForFilter();
  return shuffleEnabled ? shuffle(filteredCards) : filteredCards;
}

function renderVocabularyList() {
  const filteredCards = cardsForFilter();
  const rows = $('#vocabularyRows');
  rows.replaceChildren();
  $('#vocabularyListCount').textContent = filteredCards.length;

  if (!filteredCards.length) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'vocabulary-row';
    emptyRow.setAttribute('role', 'row');
    const emptyCell = document.createElement('span');
    emptyCell.className = 'vocabulary-empty';
    emptyCell.setAttribute('role', 'cell');
    emptyCell.textContent = studyFilter === 'known'
      ? 'Aucune carte marquée « Je sais ».'
      : 'Aucune carte dans ce mode.';
    emptyRow.append(emptyCell);
    rows.append(emptyRow);
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredCards.forEach((card) => {
    const row = document.createElement('div');
    row.className = 'vocabulary-row';
    row.setAttribute('role', 'row');
    const french = document.createElement('span');
    french.setAttribute('role', 'cell');
    french.textContent = card.fr;
    const english = document.createElement('span');
    english.setAttribute('role', 'cell');
    english.textContent = card.en;
    row.append(french, english);
    fragment.append(row);
  });
  rows.append(fragment);
}

function knownCountForSet(set) {
  const fallback = set.id === DEFAULT_SET.id ? storage.get('mot-a-mot-known', []) : [];
  return storage.get(knownCardsKey(set.id), fallback).length;
}

function renderCatalog() {
  const courseTabs = $('#courseTabs');
  const setList = $('#setList');
  courseTabs.replaceChildren(...CATALOG.map((course) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'course-tab';
    button.textContent = course.label;
    button.dataset.course = course.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(course.id === browsedCourseId));
    button.classList.toggle('active', course.id === browsedCourseId);
    button.addEventListener('click', () => {
      browsedCourseId = course.id;
      renderCatalog();
    });
    return button;
  }));

  const course = CATALOG.find((item) => item.id === browsedCourseId) || CATALOG[0];
  if (!course?.sets.length) {
    const empty = document.createElement('div');
    empty.className = 'set-empty';
    empty.innerHTML = `<strong>${escapeHtml(course?.label || '')}</strong><span>Les sets arrivent bientôt.</span>`;
    setList.replaceChildren(empty);
    return;
  }

  setList.replaceChildren(...course.sets.map((set) => {
    const parsed = parseTsv(set.tsv);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'set-card';
    button.classList.toggle('active', set.id === activeSet.id);
    button.setAttribute('aria-pressed', String(set.id === activeSet.id));
    button.innerHTML = `<span class="set-card-copy"><b>${escapeHtml(set.shortTitle)}</b><small>${escapeHtml(set.description)}</small></span><span class="set-card-progress"><b>${knownCountForSet(set)}/${parsed.length}</b><small>Je sais</small></span>`;
    button.addEventListener('click', () => selectSet(set.id));
    return button;
  }));
}

function selectSet(setId) {
  const nextSet = ALL_SETS.find((set) => set.id === setId);
  if (!nextSet || nextSet.id === activeSet.id) return;
  playSessionActive = false;
  playRunning = false;
  clearPlayTimer();
  clearTimeout(autoSpeakTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  activeSet = nextSet;
  browsedCourseId = nextSet.courseId;
  storage.set('mot-a-mot-active-set', activeSet.id);
  cards = cardsForSet();
  known = new Set(storage.get(knownCardsKey(), []));
  studyFilter = 'all';
  cardIndex = 0;
  deck = buildDeck();
  quiz = null;
  $('#quizIntro').hidden = false;
  $('#quizGame').hidden = true;
  $('#quizResult').hidden = true;
  updateSetIdentity();
  updateKnownCount();
  updatePlayButton();
  renderCard();
  $('#importCount').textContent = cards.length;
  toast(`${activeSet.courseId} · ${activeSet.shortTitle} : ${cards.length} cartes.`);
}

function updateSetIdentity() {
  const course = CATALOG.find((item) => item.id === activeSet.courseId);
  $('#courseEyebrow').textContent = `${activeSet.courseId} · ${course?.sets.length || 0} set(s)`;
  $('#activeCourseBadge').textContent = activeSet.courseId;
  $('#activeSetTitle').textContent = activeSet.title;
  document.title = `${activeSet.courseId} · ${activeSet.shortTitle} | Mot à mot`;
}

function updateFilterButton() {
  const labels = { all: 'Toutes', unknown: 'À apprendre', known: 'Je sais' };
  const listTitles = { all: 'Tout le vocabulaire', unknown: 'Vocabulaire à apprendre', known: 'Vocabulaire maîtrisé' };
  const descriptions = {
    all: 'Afficher toutes les cartes',
    unknown: 'Afficher seulement les cartes non maîtrisées',
    known: 'Afficher seulement les cartes maîtrisées',
  };
  $('#filterButtonLabel').textContent = labels[studyFilter];
  $('#filterButtonCount').textContent = cardsForFilter().length;
  $('#vocabularyListTitle').textContent = listTitles[studyFilter];
  $('#filterButton').dataset.filter = studyFilter;
  $('#filterButton').setAttribute('aria-label', descriptions[studyFilter]);
  renderVocabularyList();
}

function cycleStudyFilter() {
  const filters = ['all', 'unknown', 'known'];
  studyFilter = filters[(filters.indexOf(studyFilter) + 1) % filters.length];
  playSessionActive = false;
  playRunning = false;
  clearPlayTimer();
  clearTimeout(autoSpeakTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  deck = buildDeck();
  cardIndex = 0;
  updateFilterButton();
  updatePlayButton();
  renderCard();
  toast(`${$('#filterButtonLabel').textContent} : ${deck.length} carte(s).`);
}

function updatePlayButton() {
  const button = $('#playButton');
  button.classList.toggle('active', playRunning);
  button.setAttribute('aria-pressed', String(playRunning));
  $('#playButtonIcon').textContent = playRunning ? 'Ⅱ' : '▶';
  $('#playButtonLabel').textContent = playRunning ? 'Pause' : 'Play';
  button.title = playRunning
    ? 'Mettre la lecture en pause'
    : playSessionActive ? 'Reprendre la lecture' : `Jouer les cartes du mode ${$('#filterButtonLabel').textContent}`;
}

function updateRevealModeButton() {
  const button = $('#revealModeButton');
  button.classList.toggle('active', showBothLanguages);
  button.setAttribute('aria-pressed', String(showBothLanguages));
  button.title = showBothLanguages
    ? 'Afficher seulement la traduction après le reveal'
    : 'Afficher les deux langues après le reveal';
  $('#revealModeLabel').textContent = '2 langues';
  $('#flashcard').classList.toggle('answer-only', revealed && !showBothLanguages);
}

function updateShuffleButton() {
  const button = $('#shuffleButton');
  button.classList.toggle('active', shuffleEnabled);
  button.setAttribute('aria-pressed', String(shuffleEnabled));
  button.title = shuffleEnabled ? 'Désactiver le mélange des cartes' : 'Activer le mélange des cartes';
}

function toggleShuffle() {
  shuffleEnabled = !shuffleEnabled;
  storage.set('mot-a-mot-shuffle-enabled', shuffleEnabled);
  playSessionActive = false;
  playRunning = false;
  clearPlayTimer();
  deck = buildDeck();
  cardIndex = 0;
  updateShuffleButton();
  updatePlayButton();
  renderCard();
  toast(shuffleEnabled ? 'Shuffle activé.' : 'Shuffle désactivé.');
}

function toggleRevealMode() {
  showBothLanguages = !showBothLanguages;
  storage.set('mot-a-mot-show-both-languages', showBothLanguages);
  updateRevealModeButton();
  toast(showBothLanguages ? 'Reveal : les deux langues.' : 'Reveal : traduction seule.');
}

function clearPlayTimer() {
  clearTimeout(playTimer);
  playTimer = undefined;
}

function schedulePlayStep() {
  clearPlayTimer();
  if (!playRunning || !playSessionActive || !deck.length) return;
  playTimer = setTimeout(() => {
    playTimer = undefined;
    if (!revealed) {
      revealCard();
      return;
    }
    cardIndex = (cardIndex + 1) % deck.length;
    renderCard();
  }, PLAY_DELAY_MS);
}

function togglePlay() {
  if (playRunning) {
    playRunning = false;
    clearPlayTimer();
    clearTimeout(autoSpeakTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    updatePlayButton();
    toast('Play en pause.');
    return;
  }

  if (playSessionActive) {
    playRunning = true;
    updatePlayButton();
    schedulePlayStep();
    toast('Play repris.');
    return;
  }

  if (!deck.length) return toast('Aucune carte dans ce mode.');
  playSessionActive = true;
  playRunning = true;
  updatePlayButton();
  renderCard();
  toast(`Play · ${$('#filterButtonLabel').textContent} : ${deck.length} carte(s).`);
}

function renderCard() {
  if (!deck.length) {
    revealed = false;
    clearPlayTimer();
    $('#cardPosition').textContent = '0';
    $('#cardTotal').textContent = '0';
    $('#promptLanguage').textContent = '✓';
    $('#promptText').textContent = studyFilter === 'known' ? 'Aucune carte marquée « Je sais ».' : 'Aucune carte à travailler.';
    $('#cardNumber').textContent = '';
    $('#cardNote').textContent = '';
    $('#speakPrompt').hidden = true;
    $('#answerPanel').hidden = true;
    $('#revealButton').hidden = true;
    $('#ratingActions').hidden = true;
    $('#flashcard').classList.remove('known-card');
    $('#flashcard').dataset.cardId = '';
    return;
  }
  const card = deck[cardIndex % deck.length];
  const englishFirst = studyDirection === 'en-fr';
  const prompt = englishFirst ? card.en : card.fr;
  const answer = englishFirst ? card.fr : card.en;
  const promptCode = englishFirst ? 'EN' : 'FR';
  const answerCode = englishFirst ? 'FR' : 'EN';
  revealed = false;
  $('#cardPosition').textContent = (cardIndex % deck.length) + 1;
  $('#cardTotal').textContent = deck.length;
  $('#promptText').textContent = prompt;
  $('#answerText').textContent = answer;
  $('#promptLanguage').textContent = promptCode;
  $('#answerLanguage').textContent = answerCode;
  $('#cardNumber').textContent = `Carte ${(cardIndex % deck.length) + 1}/${deck.length}`;
  $('#directionFrom').textContent = promptCode;
  $('#directionTo').textContent = answerCode;
  $('#directionTitle').textContent = englishFirst ? 'De l’anglais vers le français' : 'Du français vers l’anglais';
  $('#speakPrompt').setAttribute('aria-label', `Écouter en ${englishFirst ? 'anglais' : 'français'}`);
  $('#speakAnswer').setAttribute('aria-label', `Écouter en ${englishFirst ? 'français' : 'anglais'}`);
  $('#speakAnswer').classList.toggle('french', englishFirst);
  $('#cardNote').textContent = card.note || '';
  $('#speakPrompt').hidden = false;
  $('#answerPanel').hidden = true;
  $('#revealButton').hidden = false;
  $('#ratingActions').hidden = true;
  $('#flashcard').dataset.cardId = card.id;
  $('#flashcard').classList.toggle('known-card', known.has(card.id));
  $('#flashcard').classList.remove('answer-only');
  maybeSpeak(prompt, englishFirst ? 'en-US' : 'fr-CA');
  schedulePlayStep();
}

function toggleStudyDirection() {
  studyDirection = studyDirection === 'en-fr' ? 'fr-en' : 'en-fr';
  storage.set('mot-a-mot-direction', studyDirection);
  renderCard();
  toast(studyDirection === 'en-fr' ? 'Anglais vers français.' : 'Français vers anglais.');
}

function revealCard() {
  if (revealed) return;
  revealed = true;
  $('#answerPanel').hidden = false;
  $('#revealButton').hidden = true;
  $('#ratingActions').hidden = false;
  $('#flashcard').classList.toggle('answer-only', !showBothLanguages);
  const card = deck[cardIndex % deck.length];
  const englishFirst = studyDirection === 'en-fr';
  maybeSpeak(englishFirst ? card.fr : card.en, englishFirst ? 'fr-CA' : 'en-US');
  schedulePlayStep();
}

function rateCard(rating) {
  const card = deck[cardIndex % deck.length];
  if (rating === 'known') known.add(card.id); else known.delete(card.id);
  updateKnownCount();
  if (studyFilter !== 'all') {
    const filteredCards = cardsForFilter();
    if (shuffleEnabled) {
      const allowedIds = new Set(filteredCards.map((item) => item.id));
      deck = deck.filter((item) => allowedIds.has(item.id));
    } else {
      deck = filteredCards;
    }
    if (!deck.length) {
      if (playSessionActive) {
        playSessionActive = false;
        playRunning = false;
        clearPlayTimer();
        updatePlayButton();
        toast('Play terminé : aucune carte ne reste dans ce mode.');
      }
      cardIndex = 0;
      renderCard();
      return;
    }
    const cardRemains = deck.some((item) => item.id === card.id);
    cardIndex = cardRemains ? (cardIndex + 1) % deck.length : cardIndex % deck.length;
    renderCard();
    return;
  }
  cardIndex = (cardIndex + 1) % deck.length;
  renderCard();
}

function navigateCard(step) {
  if (!deck.length) return;
  cardIndex = (cardIndex + step + deck.length) % deck.length;
  renderCard();
}

function switchView(name) {
  if (name !== 'study' && playRunning) {
    playRunning = false;
    clearPlayTimer();
    clearTimeout(autoSpeakTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    updatePlayButton();
  }
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === name));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}View`));
  if (name === 'import') {
    $('#importText').value = cards.map((card) => `${card.fr}\t${card.en}${card.note ? ` ${card.note}` : ''}`).join('\n');
    updateImportCount();
  }
}

function makeQuestions(source = cards, count = 10) {
  const chosen = shuffle(source).slice(0, Math.min(count, source.length));
  return chosen.map((card, index) => {
    const kind = index % 3 === 0 ? 'listen-fr' : index % 3 === 1 ? 'en-fr' : 'fr-en';
    const answerField = kind === 'en-fr' ? 'fr' : 'en';
    const distractors = shuffle(cards.filter((item) => item.id !== card.id)).slice(0, 3).map((item) => item[answerField]);
    return { card, kind, answer: card[answerField], choices: shuffle([card[answerField], ...distractors]) };
  });
}

function startQuiz(source = cards) {
  quiz = { questions: makeQuestions(source), index: 0, score: 0, mistakes: [], answered: false };
  $('#quizIntro').hidden = true;
  $('#quizResult').hidden = true;
  $('#quizGame').hidden = false;
  renderQuestion();
}

function renderQuestion() {
  const question = quiz.questions[quiz.index];
  quiz.answered = false;
  $('#quizPosition').textContent = quiz.index + 1;
  $('#quizScore').textContent = quiz.score;
  $('#quizProgress').style.width = `${((quiz.index + 1) / quiz.questions.length) * 100}%`;
  $('#feedback').hidden = true;
  $('#feedback').classList.remove('bad');
  $('#nextQuestion').hidden = true;
  $('#questionAudio').hidden = question.kind !== 'listen-fr';
  if (question.kind === 'listen-fr') {
    $('#questionKind').textContent = 'Écoute et choisis la traduction';
    $('#questionPrompt').textContent = 'Quelle phrase as-tu entendue ?';
    setTimeout(() => speak(question.card.fr, 'fr-CA'), 220);
  } else if (question.kind === 'en-fr') {
    $('#questionKind').textContent = 'De l’anglais vers le français';
    $('#questionPrompt').textContent = question.card.en;
  } else {
    $('#questionKind').textContent = 'Du français vers l’anglais';
    $('#questionPrompt').textContent = question.card.fr;
  }
  $('#choices').replaceChildren(...question.choices.map((choice) => {
    const button = document.createElement('button');
    button.className = 'choice';
    button.textContent = choice;
    button.addEventListener('click', () => answerQuestion(button, choice));
    return button;
  }));
}

function answerQuestion(button, choice) {
  if (quiz.answered) return;
  quiz.answered = true;
  const question = quiz.questions[quiz.index];
  const correct = choice === question.answer;
  if (correct) quiz.score += 1;
  else quiz.mistakes.push(question.card);
  $$('#choices .choice').forEach((item) => {
    item.disabled = true;
    if (item.textContent === question.answer) item.classList.add('correct');
  });
  if (!correct) button.classList.add('wrong');
  const feedback = $('#feedback');
  feedback.hidden = false;
  feedback.classList.toggle('bad', !correct);
  feedback.textContent = correct ? 'Exact.' : `La bonne réponse : ${question.answer}`;
  $('#quizScore').textContent = quiz.score;
  $('#nextQuestion').textContent = quiz.index === quiz.questions.length - 1 ? 'Voir mon résultat' : 'Question suivante';
  $('#nextQuestion').hidden = false;
}

function nextQuestion() {
  if (quiz.index < quiz.questions.length - 1) {
    quiz.index += 1;
    renderQuestion();
  } else showResult();
}

function showResult() {
  $('#quizGame').hidden = true;
  $('#quizResult').hidden = false;
  const percent = Math.round((quiz.score / quiz.questions.length) * 100);
  $('#resultScore').textContent = `${percent}%`;
  $('#resultTitle').textContent = percent >= 80 ? 'C’est solide.' : percent >= 60 ? 'Tu avances.' : 'On révise les pièges.';
  $('#resultCopy').textContent = `${quiz.score} bonne(s) réponse(s) sur ${quiz.questions.length}.`;
  $('#mistakeList').replaceChildren(...quiz.mistakes.map((card) => {
    const item = document.createElement('div');
    item.className = 'mistake-item';
    item.innerHTML = `<strong>${escapeHtml(card.en)}</strong>${escapeHtml(card.fr)}`;
    return item;
  }));
  $('#retryMistakes').hidden = quiz.mistakes.length === 0;
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function updateImportCount() {
  const parsed = parseTsv($('#importText').value);
  $('#importCount').textContent = parsed.length;
  $('#importStatus').classList.toggle('bad', !parsed.length);
  return parsed;
}

function applyImport() {
  const parsed = updateImportCount();
  if (parsed.length < 4) return toast('Ajoute au moins quatre cartes pour créer un test.');
  cards = parsed;
  cardIndex = 0;
  known = new Set();
  playSessionActive = false;
  playRunning = false;
  studyFilter = 'all';
  deck = buildDeck();
  clearPlayTimer();
  storage.set(customCardsKey(), cards);
  updateKnownCount();
  updatePlayButton();
  renderCard();
  toast(`${cards.length} cartes importées.`);
  switchView('study');
}

function restoreSample() {
  localStorage.removeItem(customCardsKey());
  cards = parseTsv(activeSet.tsv);
  cardIndex = 0;
  known = new Set();
  playSessionActive = false;
  playRunning = false;
  studyFilter = 'all';
  deck = buildDeck();
  clearPlayTimer();
  updateKnownCount();
  updatePlayButton();
  $('#importText').value = DEFAULT_TSV;
  updateImportCount();
  renderCard();
  toast('Set original rétabli.');
}

let toastTimer;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
}

$$('.tab').forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));
$('#filterButton').addEventListener('click', cycleStudyFilter);
$('#revealButton').addEventListener('click', revealCard);
$('#flashcard').addEventListener('click', (event) => {
  if (!revealed && !event.target.closest('button')) revealCard();
});
$$('[data-rating]').forEach((button) => button.addEventListener('click', () => rateCard(button.dataset.rating)));
$('#shuffleButton').addEventListener('click', toggleShuffle);
$('#playButton').addEventListener('click', togglePlay);
$('#revealModeButton').addEventListener('click', toggleRevealMode);
$('#directionButton').addEventListener('click', toggleStudyDirection);
$('#previousCard').addEventListener('click', () => navigateCard(-1));
$('#nextCard').addEventListener('click', () => navigateCard(1));
$('#autoSoundFrench').addEventListener('change', (event) => setAutoSound('fr', event.target.checked));
$('#autoSoundEnglish').addEventListener('change', (event) => setAutoSound('en', event.target.checked));
$('#speakPrompt').addEventListener('click', () => {
  const card = deck[cardIndex % deck.length];
  speak(studyDirection === 'en-fr' ? card.en : card.fr, studyDirection === 'en-fr' ? 'en-US' : 'fr-CA');
});
$('#speakAnswer').addEventListener('click', () => {
  const card = deck[cardIndex % deck.length];
  speak(studyDirection === 'en-fr' ? card.fr : card.en, studyDirection === 'en-fr' ? 'fr-CA' : 'en-US');
});
$('#speakAnswerSlow').addEventListener('click', () => {
  const card = deck[cardIndex % deck.length];
  speak(studyDirection === 'en-fr' ? card.fr : card.en, studyDirection === 'en-fr' ? 'fr-CA' : 'en-US', .68);
});
$('#startQuiz').addEventListener('click', () => startQuiz());
$('#nextQuestion').addEventListener('click', nextQuestion);
$('#questionAudio').addEventListener('click', () => speak(quiz.questions[quiz.index].card.fr, 'fr-CA'));
$('#retryMistakes').addEventListener('click', () => startQuiz(quiz.mistakes));
$('#restartQuiz').addEventListener('click', () => startQuiz());
$('#importText').addEventListener('input', updateImportCount);
$('#useImport').addEventListener('click', applyImport);
$('#restoreSample').addEventListener('click', restoreSample);

updateSetIdentity();
renderCatalog();
updateKnownCount();
updateAutoSoundControls();
updatePlayButton();
updateRevealModeButton();
updateShuffleButton();
updateFilterButton();
deck = buildDeck();
renderCard();
$('#importCount').textContent = cards.length;
window.speechSynthesis?.getVoices();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
