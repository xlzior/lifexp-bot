import { XPData } from "../types/data";

const XP_PER_LEVEL = [ 0, // 0-indexing =/
  500,  // 1 -> 2
  1000,
  1500,
  2000,
  3000,
  4000,
  5000,
  6000,
  7000, // 9 -> 10
  9000,
  11000,
  13000,
  15000,
  17000,
  21000,
  25000,
  29000,
  33000,
  37000, // 19 -> 20
];

const MAX_LEVEL = XP_PER_LEVEL.length;

const ROLLING_SUM = []; // base XP for each level
ROLLING_SUM[0] = XP_PER_LEVEL[0];
XP_PER_LEVEL.forEach((xpNeeded, index) => {
  if (index === 0) return;
  ROLLING_SUM[index] = ROLLING_SUM[index - 1] + xpNeeded;
});

const xpForNextLevel = (currentLevel: number) => {
  if (currentLevel < MAX_LEVEL) return XP_PER_LEVEL[currentLevel];
  return 0;
};

const xpBaseForLevel = (currentLevel: number) => {
  if (currentLevel < MAX_LEVEL) return ROLLING_SUM[currentLevel - 1];
  return ROLLING_SUM[MAX_LEVEL - 1];
};

const FILLED_BAR = "█";
const EMPTY_BAR = "▁";
const PROGRESS_BAR_LENGTH = 10;
const generateProgressBar = (percentageFilled: number, length: number) => {
  const filled = Math.floor(percentageFilled * length);
  const empty = length - filled;
  return `${FILLED_BAR.repeat(filled)}${EMPTY_BAR.repeat(empty)}`;
};

// xp is cumulative, over all levels
export const formatStats = (level: number, xp: number, streak: number): string => {
  const levelDisplay = `Level ${level}`;
  if (level < MAX_LEVEL) {
    const numer = xp - xpBaseForLevel(level); // display non-cumulative so progress bar is intuitive
    const denom = xpForNextLevel(level);
    const progressBar = generateProgressBar(numer / denom, PROGRESS_BAR_LENGTH);
    return `${levelDisplay}    ${progressBar}    ${numer}/${denom}    🔥 ${streak}`;
  }

  // max level reached
  return `${levelDisplay} (MAX)    ${xp} XP    🔥 ${streak}`;
};

export const incrementXP = (
  level: number,
  originalXP: number,
  additionalXP: number
): XPData => {
  const xpThreshold = xpBaseForLevel(level + 1);
  const xp = originalXP + additionalXP;
  const levelledUp = xp >= xpThreshold;
  if (level < MAX_LEVEL) {
    return {
      xp,
      level: levelledUp ? level + 1 : level,
      levelledUp,
    };
  }

  // max level reached
  return { xp, level, levelledUp: false };
};
