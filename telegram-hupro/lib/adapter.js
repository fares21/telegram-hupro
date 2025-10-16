const TelegramBot = require('node-telegram-bot-api');
const { TextMessage, EnterMessage, LeaveMessage } = require('./message');

class TelegramAdapter {
  constructor(robot) {
    this.robot = robot;
    this.bot = null;
    this.token = process.env.BOT_TOKEN;
    
    if (!this.token) {
      this.robot.logger.error('❌ BOT_TOKEN is required');
      process.exit(1);
    }
    
    this.robot.logger.info('🔌 Telegram adapter initialized');
  }

  send(envelope, ...strings) {
    const chatId = envelope.room || envelope.user.id;
    
    strings.forEach(str => {
      this.bot.sendMessage(chatId, str, { parse_mode: 'Markdown' })
        .catch(err => this.robot.logger.error(`Error sending message: ${err}`));
    });
  }

  reply(envelope, ...strings) {
    const chatId = envelope.room || envelope.user.id;
    const username = envelope.user.name || envelope.user.first_name;
    
    strings.forEach(str => {
      const message = `@${username} ${str}`;
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
        .catch(err => this.robot.logger.error(`Error replying: ${err}`));
    });
  }

  emote(envelope, ...strings) {
    return this.send(envelope, ...strings.map(s => `_${s}_`));
  }

  topic(envelope, ...strings) {
    // تيليجرام لا يدعم topics في المجموعات العادية
    this.robot.logger.debug('Topic change not supported in Telegram');
  }

  play(envelope, ...strings) {
    // يمكن إرسال ملفات صوتية أو فيديو
    return this.send(envelope, ...strings);
  }

  locked(envelope, ...strings) {
    return this.send(envelope, ...strings);
  }

  run() {
    this.bot = new TelegramBot(this.token, { polling: true });
    
    this.robot.logger.info('✅ Telegram bot connected');
    
    // معالجة الرسائل النصية
    this.bot.on('message', (msg) => {
      // تجاهل الرسائل غير النصية المؤقتة
      if (!msg.text) return;
      
      const user = this.createUser(msg.from, msg.chat.id);
      const message = new TextMessage(user, msg.text, msg.message_id);
      
      this.robot.receive(message);
      
      // حفظ المستخدم في Brain
      this.robot.brain.userForId(user.id, {
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        room: user.room
      });
    });

    // معالجة الأعضاء الجدد
    this.bot.on('new_chat_members', (msg) => {
      msg.new_chat_members.forEach(member => {
        const user = this.createUser(member, msg.chat.id);
        const message = new EnterMessage(user, null, msg.message_id);
        this.robot.receive(message);
      });
    });

    // معالجة المغادرين
    this.bot.on('left_chat_member', (msg) => {
      const user = this.createUser(msg.left_chat_member, msg.chat.id);
      const message = new LeaveMessage(user, null, msg.message_id);
      this.robot.receive(message);
    });

    // معالجة callback queries (الأزرار)
    this.bot.on('callback_query', (query) => {
      const user = this.createUser(query.from, query.message.chat.id);
      const message = new TextMessage(user, query.data, query.id);
      
      this.robot.receive(message);
      
      // الرد على الـ callback
      this.bot.answerCallbackQuery(query.id)
        .catch(err => this.robot.logger.error(`Error answering callback: ${err}`));
    });

    // معالجة الأخطاء
    this.bot.on('polling_error', (error) => {
      this.robot.logger.error(`Polling error: ${error}`);
    });

    this.emit('connected');
  }

  createUser(telegramUser, chatId) {
    return {
      id: telegramUser.id,
      name: telegramUser.username || `user${telegramUser.id}`,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      room: chatId,
      telegram: telegramUser
    };
  }

  // إرسال أزرار inline
  sendInlineKeyboard(chatId, text, buttons) {
    const keyboard = {
      inline_keyboard: buttons
    };
    
    return this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  // إرسال keyboard عادي
  sendKeyboard(chatId, text, buttons) {
    const keyboard = {
      keyboard: buttons,
      resize_keyboard: true,
      one_time_keyboard: true
    };
    
    return this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  close() {
    if (this.bot) {
      this.bot.stopPolling();
      this.robot.logger.info('🔌 Telegram adapter disconnected');
    }
  }
}

module.exports = TelegramAdapter;
