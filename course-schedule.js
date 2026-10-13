(function exposeCourseSchedule(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MotAMotCourseSchedule = api;
}(typeof window !== 'undefined' ? window : globalThis, function createCourseSchedule() {
  const LEVELS = ['A1', 'A2', 'B1', 'B2'];

  function levelFromLabel(label = '') {
    return String(label).match(/(?:-|Test\s+)(A1|A2|B1|B2)$/i)?.[1]?.toUpperCase() || null;
  }

  function parseStartDate(label = '') {
    const match = String(label).match(/^[+#!]?(\d{2})(\d{2})(\d{2})-/);
    if (!match) return null;
    return new Date(Date.UTC(2000 + Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function parseDateKey(dateKey) {
    const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function montrealDateKey(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  }

  function isTestCourse(label = '') {
    return /^Test (A1|A2|B1|B2)$/i.test(String(label));
  }

  function isWeekendCourse(label = '') {
    return /-(?:w|we)[1-4]-(?:A1|A2|B1|B2)$/i.test(String(label));
  }

  function isQuizSet(set) {
    return /^Quiz\b/i.test(String(set?.title || set?.shortTitle || ''));
  }

  function cardCount(set) {
    if (Array.isArray(set?.cards)) return set.cards.length;
    return String(set?.tsv || '').split(/\r?\n/).filter((line) => line.trim()).length;
  }

  function completedCourseBlocks(courseLabel, todayKey) {
    const start = parseStartDate(courseLabel);
    const today = parseDateKey(todayKey);
    if (!start || !today) return 0;
    const firstCompletionOffset = isWeekendCourse(courseLabel) ? 0 : 3;
    let completed = 0;
    for (let week = 0; week < 5; week += 1) {
      const completion = new Date(start.getTime() + (firstCompletionOffset + (week * 7)) * 86400000);
      if (today.getTime() > completion.getTime()) completed += 1;
    }
    return completed;
  }

  function goalForCatalog(catalog, access, todayKey = montrealDateKey()) {
    const courseLabel = String(access?.courseLabel || '');
    const courseLevel = levelFromLabel(courseLabel) || String(access?.maxLevel || '').toUpperCase();
    const course = (catalog || []).find((item) => item.id === courseLevel);
    if (!course || !LEVELS.includes(courseLevel)) {
      return { courseLevel, courseLabel, setIds: [], totalCards: 0, availableSets: 0, totalSets: 0, isTest: false };
    }
    const test = isTestCourse(courseLabel);
    const eligibleSets = test ? course.sets : course.sets.filter((set) => !isQuizSet(set));
    const availableSets = test
      ? eligibleSets.length
      : Math.min(eligibleSets.length, Math.max(1, completedCourseBlocks(courseLabel, todayKey) + 1));
    const included = eligibleSets.slice(0, availableSets);
    return {
      courseLevel,
      courseLabel,
      setIds: included.map((set) => set.id),
      totalCards: included.reduce((sum, set) => sum + cardCount(set), 0),
      availableSets,
      totalSets: eligibleSets.length,
      isTest: test,
    };
  }

  return {
    completedCourseBlocks,
    goalForCatalog,
    isTestCourse,
    isWeekendCourse,
    levelFromLabel,
    montrealDateKey,
    parseStartDate,
  };
}));
