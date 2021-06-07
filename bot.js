const Bot = require('node-telegram-bot-api');

const {
  createUser,
  setPinnedMessageId, addXP, getProgress,
  updatePrevCommand, resetPrevCommand, getPrevCommand,
  openReflection, closeReflection, isReflectionOpen,
  addHashtags, getHashtags,
  addEmojis, getEmojis,
  getStats,
} = require('./db');

const { getRandomPrompt, countEmojis, emojiChart } = require('./utils');
const { formatLevel } = require('./levels');

const token = process.env.TOKEN;

let bot;
if(process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, { polling: true });
}

console.log('Bot server started in ' + process.env.NODE_ENV + ' mode');

/* BOT UTILITIES */

const updateUserOnXPChange = (chatId, type, xpData) => {
  const { level, levelledUp, additionalXP, newXP, pinnedMessageId } = xpData;
  bot.sendMessage(chatId, `You earned ${additionalXP} XP for ${type}!`);
  if (levelledUp) {
    bot.sendMessage(chatId, `You levelled up! You are now level ${level}`);
  }
  bot.editMessageText(formatLevel(level, newXP), {
    chat_id: chatId,
    message_id: pinnedMessageId,
  })
}

const sendAndPin = (chatId, message) => {
  return bot.sendMessage(chatId, message)
  .then(botMsg => {
    bot.pinChatMessage(chatId, botMsg.message_id);
    return botMsg.message_id;
  })
}

const FORCE_REPLY = { reply_markup: { force_reply: true } };
const MARKDOWN = { parse_mode: "MarkdownV2" };

/* BOT RESPONSES */

const continueConversation = {};

bot.onText(/\/prompt/, msg => {
  bot.sendMessage(msg.chat.id, getRandomPrompt());
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, match[1]);
});

bot.onText(/\/start/, msg => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Hello, ${msg.from.first_name}! Welcome to LifeXP, a gamified journalling chatbot.`);

  createUser(userId)
  .then(() => sendAndPin(chatId, formatLevel(1, 0)))
  .then(messageId => setPinnedMessageId(userId, messageId));
})

bot.onText(/\/help/, msg => {
  const helpMessage = [
    "Welcome to LifeXP, a gamified journalling chatbot.\n",
    "I'm here to help you pen down your thoughts in a safe and convenient environment.\n",
    "Use /open to start a new journal entry.",
    "If you need a prompt to start off, let me know using /prompt.",
    "If you did something that you're proud of and want to celebrate it, try /ididathing.",
    "Finally, /close the journal entry and let your mind rest.\n",
    "I hope you have a meaningful journalling session."
  ].join("\n");
  bot.sendMessage(msg.chat.id, helpMessage)
})

bot.onText(/\/tour/, msg => {
  // TODO: tour to go through all features?
})

bot.onText(/\/open/, msg => {
  openReflection(msg.from.id, msg.message_id)
  .then(() => {
    bot.sendMessage(msg.chat.id, "Let's start a journalling session! If you need a prompt, you can use /prompt. If not, just start typing and I'll be here when you need me.")
  })
  .catch(error => {
    bot.sendMessage(msg.chat.id, error);
  });
})

bot.onText(/\/close/, msg => {
  isReflectionOpen(msg.from.id)
  .then(isOpen => {
    if (isOpen) {
      bot.sendMessage(msg.chat.id, "Whew! Nice journalling session. How would you like to name this conversation for future browsing?", FORCE_REPLY)
      updatePrevCommand(msg.from.id, { command: "close" })
    } else {
      bot.sendMessage(msg.chat.id, "You have not started a reflection. Use /open to start a new reflection");
    }
  })
  .catch(error => {
    console.log(error)
  })
})

continueConversation["close"] = async (msg) => {
  try {
    const userId = msg.from.id;
    const emojis = await getEmojis(userId);
    const convoLength = await closeReflection(userId, msg.message_id, msg.text);
  
    await bot.sendMessage(msg.chat.id, `Good job! You wrapped up the '${msg.text}' conversation. I'm proud of you!`)
    // TODO: only send if more than 5 emojis total and 2 distinct types
    await bot.sendMessage(msg.chat.id, `You used these emojis in this entry:\n${emojiChart(emojis)}`)
  
    const xpData = await addXP(msg.from.id, convoLength);
    
    updateUserOnXPChange(msg.chat.id, "this conversation", xpData);
    resetPrevCommand(userId);
  } catch (error) {
    console.log('error :', error);
  }
}

bot.onText(/\/hashtags/, msg => {
  getHashtags(msg.from.id)
  .then(hashtags => {
    const message = hashtags
      .map(({ hashtag, messages }) => {
        const firstLine = `*\\#${hashtag}: ${messages.length}*`
        const nextLines = messages
          .map(({ messageId, name }) => `\\- /goto${messageId} ${name}`)
          .join('\n')
        return `${firstLine}\n${nextLines}`;
      })
      .join('\n\n');
    bot.sendMessage(msg.chat.id, message, MARKDOWN);
  })
  .catch(error => {
    bot.sendMessage(msg.chat.id, error);
  })
});

bot.onText(/\/goto(\d+)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, "The conversation started here!", {
    reply_to_message_id: match[1]
  })
})

bot.onText(/\/emojis/, msg => {

})

bot.onText(/\/lifexp/, msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  getProgress(userId)
  .then(({ level, xp, pinnedMessageId }) => {
    bot.unpinChatMessage(chatId, pinnedMessageId);
    sendAndPin(chatId, formatLevel(level, xp))
    .then(messageId => setPinnedMessageId(userId, messageId));
  });
})

bot.onText(/\/ididathing/, msg => {
  bot.sendMessage(msg.chat.id, "Congrats! Whether it's a small win or a big win, let's celebrate it!")
  .then(() => {
    bot.sendMessage(msg.chat.id, "So tell me, what did you do?", FORCE_REPLY);
  })
  updatePrevCommand(msg.from.id, { command: "ididathing - what" });
})

continueConversation["ididathing - what"] = msg => {
  bot.sendMessage(msg.chat.id, "Amazing! How do you feel about it now?", FORCE_REPLY);
  updatePrevCommand(msg.from.id, { command: "ididathing - feeling" });
}

continueConversation["ididathing - feeling"] = msg => {
  bot.sendMessage(msg.chat.id, "Nice~ On a scale of 1 to 10, how difficult would you rate it?", FORCE_REPLY);
  updatePrevCommand(msg.from.id, { command: "ididathing - difficulty" });
}

const DIFFICULTY_XP_MULTIPLIER = 100;

continueConversation["ididathing - difficulty"] = msg => {
  const send = message => bot.sendMessage(msg.chat.id, message);
  const match = msg.text.match(/\d+/);
  if (!match) return send("Please enter a valid number between 1 and 10 (inclusive)");

  const difficulty = parseInt(match[0]);
  if (difficulty < 1 || difficulty > 10) {
    send("Please enter a valid number between 1 and 10 (inclusive)");
  } else {
    if (difficulty <= 3) {
      send("That's cool! Small wins count too~");
    } else if (difficulty <= 6) {
      send("Nice, good job!")
    } else if (difficulty <= 9) {
      send("Wowowow, big win right there :D");
    } else if (difficulty === 10) {
      send("THAT'S AMAZING!! YOOOO I'M SO PROUD OF YOU!!")
    }

    return addXP(msg.from.id, difficulty * DIFFICULTY_XP_MULTIPLIER)
    .then(xpData => {
      updateUserOnXPChange(msg.chat.id, "your achievement", xpData);
      return resetPrevCommand(msg.from.id);
    })
  }
}

bot.onText(/\/stats/, msg => {
  getStats(msg.from.id)
  .then(({ level, xp, reflections, hashtags }) => {
    const progressDisplay = `*Level*: ${level}\n*Total XP*: ${xp}`;
    const reflectionsDisplay = `*Number of entries*: ${reflections}`;
    const hashtagsDisplay = `*Number of hashtags used*: ${hashtags}\n_\\(use /hashtags to browse\\)_`;
    const message = `${progressDisplay}\n\n${reflectionsDisplay}\n\n${hashtagsDisplay}`;
    bot.sendMessage(msg.chat.id, message, MARKDOWN)
  })
})

// Messages with no command

bot.on('message', msg => {
  const userId = msg.from.id;

  // TODO: automatically open a conversation for a smoother journalling experience?

  if (msg.entities) {
    const hashtags = msg.entities
      .filter(({ type }) => type === 'hashtag')
      .map(({ offset, length }) => msg.text.substr(offset, length));
    addHashtags(userId, hashtags);
  }

  addEmojis(userId, countEmojis(msg.text));

  getPrevCommand(userId)
  .then(({ command }) => {
    if (continueConversation[command]) {
      continueConversation[command](msg);
    } else {
      console.log('Encountered unfamiliar command: ', command)
    }
  })
  .catch(() => {});
});

bot.on("polling_error", (err) => console.log(err));

module.exports = bot;
