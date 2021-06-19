const emojiTree = require('emoji-tree');

const prompts = require('./prompts.json');

const getRandomPrompt = () => {
  const index = Math.floor(Math.random() * prompts.random.length);
  return prompts.random[index];
}

const countEmojis = (rawText) => {
  const result = {};
  
  emojiTree(rawText)
    .filter(char => char.type === 'emoji')
    .map(({ text: emoji }) => {
      if (!result[emoji]) result[emoji] = 0;
      result[emoji]++;
    })
  return result;
}

const emojiChart = (emojiCounts) => {
  return Object.keys(emojiCounts)
    .map(emoji => emoji.repeat(emojiCounts[emoji]))
    .join('\n');
}

const formatHashtag = (limit) => ({ hashtag, messages }) => {
  const firstLine = `*${hashtag}: ${messages.length}*`
  const nextLines = messages
    .map(([ messageId, name ]) => `- /goto${messageId} ${name}`)
    .slice(0, limit)
    .join('\n')
  return `${firstLine}\n${nextLines}`;
}

const sum = (arr) => arr.reduce((x, y) => x + y, 0)

const average = (arr) => sum(arr) / arr.length;

const max = (arr) => Math.max(...arr);

const RESERVED_CHARACTERS = ["-", "#", "+", "_", "(", ")"];

const cleanMarkdownReserved = rawText => {
  let result = rawText;
  RESERVED_CHARACTERS.forEach(char => {
    result = result.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  })
  result = result.replace(/<\/?i>/g, '_');
  return result;
}

const groupPairs = array => {
  const result = [];
  for (let i = 0; i < array.length; i += 2) {
    result.push(array.slice(i, i + 2));
  }
  return result;
}

module.exports = {
  getRandomPrompt,
  countEmojis, emojiChart,
  formatHashtag,
  sum, average, max,
  cleanMarkdownReserved, groupPairs,
}