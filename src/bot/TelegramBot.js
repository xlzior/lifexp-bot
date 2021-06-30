const Bot = require("node-telegram-bot-api");

const { getBadgeImage, getBadgeLabel } = require("../achievements");
const { formatLevel } = require("../levels");

// refactor out commonly used functionality
// e.g. bot.sendMessage(msg.chat.id, message, options) becomes send(message, options)
const generateShortcuts = (thisBot, msg) => ({
  userId: msg.from.id,
  chatId: msg.chat.id,
  send (...args) { return thisBot.sendMessage(msg.chat.id, ...args); },
});

Bot.prototype.originalOnText = Bot.prototype.onText;

Bot.prototype.onText = function(regex, callback) {
  const botReference = this;
  return this.originalOnText(regex, function(msg, match) {
    const shortcuts = generateShortcuts(botReference, msg);
    callback(shortcuts, msg, match);
  });
};

Bot.prototype.onMessage = function(callback) {
  const botReference = this;
  return this.on("message", function(msg) {
    const shortcuts = generateShortcuts(botReference, msg);
    callback(shortcuts, msg);
  });
};

Bot.prototype.notifyXP = async function(chatId, type, xpData) {
  const { level, levelledUp, additionalXP, xp, pinnedMessageId } = xpData;
  await this.sendMessage(chatId, `You earned ${additionalXP} XP for ${type}!`);
  if (levelledUp) await this.sendMessage(chatId, `You levelled up! You are now Level ${level}.`);
  await this.editMessageText(formatLevel(level, xp), {
    chat_id: chatId,
    message_id: pinnedMessageId,
  });
};

Bot.prototype.notifyBadge = function(chatId, type, badgeLevel) {
  const badgeImage = getBadgeImage(type, badgeLevel);
  return this.sendPhoto(chatId, badgeImage,
    { caption: `New Achievement! ${getBadgeLabel(type, badgeLevel)}` });
};

Bot.prototype.notifyBadges = async function(chatId, type, previousLevel, currentLevel) {
  for (let i = previousLevel + 1; i <= currentLevel; i++) {
    await this.notifyBadge(chatId, type, i);
  }
};

Bot.prototype.sendAndPin = async function(chatId, message) {
  const botMsg = await this.sendMessage(chatId, message);
  this.pinChatMessage(chatId, botMsg.message_id);
  return botMsg.message_id;
};

const MAX_PER_MEDIA_GROUP = 9;
// Telegram media groups allow up to 10 photos in one message
// but since achievements come in groups of 3, groups of 9 are more suitable

// depending on the number of photos, send the appropriate number of media groups
Bot.prototype.sendPhotos = async function(chatId, photos) {
  if (photos.length === 1) { // send an individual photo
    const { media, caption } = photos[0];
    await this.sendPhoto(chatId, media, { caption });
  } else if (photos.length <= MAX_PER_MEDIA_GROUP) { // send a media group
    await this.sendMediaGroup(chatId, photos);
  } else { // send multiple media groups
    await this.sendMediaGroup(chatId, photos.slice(0, MAX_PER_MEDIA_GROUP)); // send the first batch
    await this.sendPhotos(chatId, photos.slice(MAX_PER_MEDIA_GROUP));        // recurse for the rest
  }
};

module.exports = Bot;
