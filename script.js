const suffixes = {
  noun: ["tion", "ness", "ment", "ity", "er", "or", "ance", "ence", "al", "ism", "ist", "ship", "hood", "dom"],
  verb: ["ify", "ize"],
  adjective: ["ous", "ful", "less", "able", "ible", "ive", "ic", "ish"],
  adverb: ["ly", "lly"],
};

const suffixSyllables = {
  tion: 1, ness: 1, ment: 1, ity: 2, er: 1, or: 1, ance: 1, ence: 1, al: 1, ism: 2, ist: 1, ship: 1, hood: 1, dom: 1,
  ify: 2, ize: 1,
  ous: 1, ful: 1, less: 1, able: 2, ible: 2, ive: 1, ic: 1, ish: 1,
  ly: 1, lly: 1,
};

const singleOnsets = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z", "ch", "sh", "th"];
const clusterOnsets = ["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw"];
const firstOnsets = ["", "", ...singleOnsets];
const openRimes = ["a", "e", "i", "o", "u", "ay", "ea", "ee", "oa", "oo", "ow", "ue"];
const finalRimes = ["an", "en", "on", "in", "er", "ar", "or", "el", "ell", "et", "at", "it", "ad", "ed", "am", "em", "ash", "ant", "ale", "ane", "ake", "ate", "ore", "ole", "one", "ice", "ine", "ide", "air", "ear", "own", "out", "ace", "age", "ike", "ile", "ire", "ite", "oke", "ose", "eal", "ood", "oon", "oom"];

const form = document.querySelector("#generatorForm");
const themeModeSelect = document.querySelector("#themeMode");
const verseCountInput = document.querySelector("#verseCount");
const lineCountInput = document.querySelector("#lineCount");
const outroLineCountInput = document.querySelector("#outroLineCount");
const syllableCountInput = document.querySelector("#syllableCount");
const lyricsOutput = document.querySelector("#lyricsOutput");
const copyButton = document.querySelector("#copyButton");
const statusMessage = document.querySelector("#statusMessage");
const themeModes = ["system", "light", "dark"];

function getSavedTheme() {
  try {
    const savedTheme = localStorage.getItem("pseudoMusicTheme");
    return themeModes.includes(savedTheme) ? savedTheme : "system";
  } catch {
    return "system";
  }
}

function setTheme(theme) {
  const selectedTheme = themeModes.includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = selectedTheme;
  themeModeSelect.value = selectedTheme;

  try {
    localStorage.setItem("pseudoMusicTheme", selectedTheme);
  } catch {
    // The selected theme still applies for this page even if storage is unavailable.
  }
}

function pick(items) {
  return items[randint(0, items.length - 1)];
}

function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeBase(syllables, lastRime = null) {
  let word = "";

  for (let index = 0; index < syllables; index += 1) {
    let onset;

    if (index === 0) {
      onset = randint(1, 100) <= 20 ? pick(clusterOnsets) : pick(firstOnsets);
    } else {
      onset = pick(singleOnsets);
    }

    const isLastSyllable = index === syllables - 1;
    const rime = isLastSyllable && lastRime !== null
      ? lastRime
      : pick(isLastSyllable ? finalRimes : openRimes);

    word += onset + rime;
  }

  return word;
}

function makeWordData(pos, ending = null, syllables = null, conjugate = false, rhymeRime = null) {
  ending = ending ? ending.toLowerCase().replace(/^-/, "") : pick(suffixes[pos]);

  if (!suffixes[pos].includes(ending)) {
    throw new Error(`Invalid ending '${ending}' for ${pos}.`);
  }

  const endingSyllables = suffixSyllables[ending]
    + (conjugate && pos === "verb" && ending === "ize" ? 1 : 0);
  const baseSyllables = syllables === null ? randint(1, 3) : syllables - endingSyllables;

  if (baseSyllables < 1 || baseSyllables > 3) {
    throw new Error("Invalid syllable count for word.");
  }

  let base = makeBase(baseSyllables, rhymeRime);

  if (base.endsWith("e") && "aeiou".includes(ending[0])) {
    base = base.slice(0, -1);
  }

  let word = base + ending;

  if (conjugate) {
    if (word.endsWith("y") && word.length > 1 && !"aeiou".includes(word.at(-2))) {
      word = word.slice(0, -1) + "ies";
    } else if (["s", "x", "z", "ch", "sh", "o"].some((endingText) => word.endsWith(endingText))) {
      word += "es";
    } else {
      word += "s";
    }
  }

  return [word, baseSyllables + endingSyllables];
}

function makeSlot(pos, ending = null, conjugate = false) {
  return {
    kind: "word",
    pos,
    suffix: ending || pick(suffixes[pos]),
    conjugate,
  };
}

function addWord(tokens, pos, ending = null, conjugate = false) {
  const slot = makeSlot(pos, ending, conjugate);
  tokens.push(slot);
  return slot;
}

function addNounPhrase(tokens, ending = null, postChance = 15) {
  const noun = makeSlot("noun", ending);
  let article = null;

  if (randint(1, 100) <= 55) {
    article = { kind: "article", target: noun };
  }

  if (randint(1, 100) <= 50) {
    const adjective = makeSlot("adjective");

    if (randint(1, 100) <= postChance) {
      if (article) tokens.push(article);
      tokens.push(noun, adjective);
    } else {
      if (article) {
        article.target = adjective;
        tokens.push(article);
      }
      tokens.push(adjective, noun);
    }
  } else {
    if (article) tokens.push(article);
    tokens.push(noun);
  }

  return noun;
}

function getSuffixSyllables(slot) {
  return suffixSyllables[slot.suffix]
    + (slot.conjugate && slot.pos === "verb" && slot.suffix === "ize" ? 1 : 0);
}

function allocateSyllables(total, slots) {
  const minimums = slots.map((slot) => getSuffixSyllables(slot) + 1);
  const maximums = slots.map((slot) => getSuffixSyllables(slot) + 3);

  if (total < minimums.reduce((sum, value) => sum + value, 0)
    || total > maximums.reduce((sum, value) => sum + value, 0)) {
    return null;
  }

  const result = [];
  let remaining = total;

  for (let index = 0; index < slots.length; index += 1) {
    const laterMinimum = minimums.slice(index + 1).reduce((sum, value) => sum + value, 0);
    const laterMaximum = maximums.slice(index + 1).reduce((sum, value) => sum + value, 0);
    const low = Math.max(minimums[index], remaining - laterMaximum);
    const high = Math.min(maximums[index], remaining - laterMinimum);

    if (low > high) return null;

    const value = randint(low, high);
    result.push(value);
    remaining -= value;
  }

  return result;
}

function makeSentence(syllables = 12, ending = null, rhymeRime = null) {
  if (!Number.isInteger(syllables) || syllables < 1) {
    throw new Error("Syllables must be a positive whole number.");
  }

  let endPos;

  if (ending !== null) {
    ending = ending.toLowerCase().replace(/^-/, "");
    const matches = Object.entries(suffixes)
      .filter(([, values]) => values.includes(ending))
      .map(([pos]) => pos);

    if (matches.length !== 1) {
      throw new Error(`Unknown or ambiguous ending: ${ending}.`);
    }

    [endPos] = matches;
  } else {
    endPos = pick(Object.keys(suffixes));
    ending = pick(suffixes[endPos]);
  }

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const tokens = [];
    addNounPhrase(tokens);

    if (endPos === "noun") {
      if (randint(1, 100) <= 50) addWord(tokens, "adverb");
      addWord(tokens, "verb", null, true);
      addNounPhrase(tokens, ending, 0);
    } else if (endPos === "verb") {
      if (randint(1, 100) <= 50) addWord(tokens, "adverb");
      addWord(tokens, "verb", ending, true);
    } else if (endPos === "adjective") {
      tokens.push({ kind: "fixed", text: "is", syllables: 1 });
      if (randint(1, 100) <= 30) addWord(tokens, "adverb");
      addWord(tokens, "adjective", ending);
    } else {
      addWord(tokens, "verb", null, true);
      addWord(tokens, "adverb", ending);
    }

    const wordSlots = tokens.filter((token) => token.kind === "word");
    const fixedSyllables = tokens
      .filter((token) => token.kind !== "word")
      .reduce((sum, token) => sum + (token.syllables ?? 1), 0);
    const allocation = allocateSyllables(syllables - fixedSyllables, wordSlots);

    if (allocation === null) continue;

    wordSlots.forEach((slot, index) => {
      const rime = index === wordSlots.length - 1 ? rhymeRime : null;
      [slot.word] = makeWordData(slot.pos, slot.suffix, allocation[index], slot.conjugate, rime);
    });

    const result = tokens.map((token) => {
      if (token.kind === "word") return token.word;
      if (token.kind === "fixed") return token.text;

      let article = pick(["a", "a", "the"]);
      const target = token.target.word;

      if (article === "a" && "aeiou".includes(target[0].toLowerCase())) {
        article = "an";
      }

      return article;
    });

    const sentence = result.join(" ");
    return `${sentence[0].toUpperCase()}${sentence.slice(1)}`;
  }

  throw new Error(`Could not generate a ${syllables}-syllable sentence ending in '${ending}'.`);
}

function makeRhymeLines(count, syllables, scheme = null) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Line count must be a positive whole number.");
  }

  if (scheme === null) scheme = pick(["AABB", "ABAB"]);
  if (!["AABB", "ABAB"].includes(scheme)) {
    throw new Error("Rhyme scheme must be AABB or ABAB.");
  }

  const labels = Array.from({ length: count }, (_, index) => scheme[index % 4]);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rhymeSpecs = {};

    for (const label of new Set(labels)) {
      const pos = pick(Object.keys(suffixes));
      rhymeSpecs[label] = [pick(suffixes[pos]), pick(finalRimes)];
    }

    try {
      const lines = labels.map((label) => {
        const [ending, rime] = rhymeSpecs[label];
        return makeSentence(syllables, ending, rime);
      });
      return [lines, scheme];
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
  }

  throw new Error(`Could not create ${count} lines with ${syllables} syllables each. Increase the syllable count or simplify the sentence structure.`);
}

function makeSong(verseCount = 3, linesPerVerse = 6, outroLineCount = 2, syllablesPerLine = 12) {
  if (!Number.isInteger(verseCount) || verseCount < 1) {
    throw new Error("Number of verses must be a positive whole number.");
  }

  if (!Number.isInteger(linesPerVerse) || linesPerVerse < 1) {
    throw new Error("Lines per section must be a positive whole number.");
  }

  if (!Number.isInteger(outroLineCount) || outroLineCount < 1) {
    throw new Error("Outro lines must be a positive whole number.");
  }

  if (!Number.isInteger(syllablesPerLine) || syllablesPerLine < 1) {
    throw new Error("Syllables per line must be a positive whole number.");
  }

  const [chorus] = makeRhymeLines(linesPerVerse, syllablesPerLine);
  const sections = [];

  for (let index = 0; index < verseCount; index += 1) {
    const [verse] = makeRhymeLines(linesPerVerse, syllablesPerLine);
    sections.push(`[Verse${index + 1}]\n${verse.join("\n")}`);
    sections.push(`[Chorus]\n${chorus.join("\n")}`);
  }

  const [outro] = makeRhymeLines(outroLineCount, syllablesPerLine, "AABB");
  sections.push(`[Outro]\n${outro.join("\n")}`);

  return sections.join("\n\n");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function generateLyrics() {
  const verseCount = Number(verseCountInput.value);
  const linesPerVerse = Number(lineCountInput.value);
  const outroLineCount = Number(outroLineCountInput.value);
  const syllablesPerLine = Number(syllableCountInput.value);

  if (!Number.isInteger(verseCount) || verseCount < 1 || verseCount > 20) {
    setStatus("Enter a verse count from 1 to 20.", true);
    return;
  }

  if (!Number.isInteger(linesPerVerse) || linesPerVerse < 1 || linesPerVerse > 20) {
    setStatus("Enter a section line count from 1 to 20.", true);
    return;
  }

  if (!Number.isInteger(outroLineCount) || outroLineCount < 1 || outroLineCount > 20) {
    setStatus("Enter an outro line count from 1 to 20.", true);
    return;
  }

  if (!Number.isInteger(syllablesPerLine) || syllablesPerLine < 1 || syllablesPerLine > 60) {
    setStatus("Enter a syllable count from 1 to 60.", true);
    return;
  }

  try {
    lyricsOutput.value = makeSong(verseCount, linesPerVerse, outroLineCount, syllablesPerLine);
    copyButton.disabled = false;
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateLyrics();
});

themeModeSelect.addEventListener("change", () => {
  setTheme(themeModeSelect.value);
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lyricsOutput.value);
    setStatus("Lyrics copied.");
  } catch {
    lyricsOutput.focus();
    lyricsOutput.select();
    const copied = document.execCommand("copy");
    setStatus(copied ? "Lyrics copied." : "Select and copy the lyrics manually.", !copied);
  }
});

setTheme(getSavedTheme());
generateLyrics();
