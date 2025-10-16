#!/usr/bin/env node

require('dotenv').config();
const path = require('path');
const Robot = require('./lib/robot');

// إنشاء البوت
const adapterPath = path.join(__dirname, 'lib', 'adapter.js');
const robot = new Robot(
  adapterPath,
  'telegram',
  true, // تفعيل HTTP server
  process.env.HUBOT_NAME || 'Hubot',
  process.env.HUBOT_ALIAS
);

// تحميل السكربتات الأساسية
robot.load(path.resolve(__dirname, 'scripts'));

// تحميل external scripts إذا وجدت
const externalScripts = path.resolve(__dirname, 'external-scripts.json');
const fs = require('fs');

if (fs.existsSync(externalScripts)) {
  try {
    const scripts = JSON.parse(fs.readFileSync(externalScripts, 'utf-8'));
    robot.logger.info(`📦 Loading ${scripts.length} external scripts`);
    
    scripts.forEach(script => {
      try {
        require(script)(robot);
        robot.logger.info(`  ✅ ${script}`);
      } catch (err) {
        robot.logger.error(`  ❌ ${script}: ${err.message}`);
      }
    });
  } catch (err) {
    robot.logger.error(`Error loading external scripts: ${err}`);
  }
}

// Middleware للتسجيل
robot.middleware.receive.register((context, next, done) => {
  robot.logger.debug(`📨 Received: ${context.response.message.text}`);
  next(done);
});

// Middleware للتحكم في الوصول
robot.middleware.listener.register((context, next, done) => {
  const adminId = parseInt(process.env.ADMIN_ID);
  
  // التحقق من الأوامر الإدارية
  if (context.listener.options.adminOnly && context.response.message.user.id !== adminId) {
    context.response.reply('⛔ هذا الأمر متاح للإدمن فقط');
    return done();
  }
  
  next(done);
});

// Middleware للتبريد - 24 ساعة
const cooldowns = new Map();
const MESSAGE_LIMIT = 10;
const COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 24 ساعة

robot.middleware.receive.register((context, next, done) => {
  const userId = context.response.message.user.id;
  const adminId = parseInt(process.env.ADMIN_ID);
  
  // الإدمن معفي من التبريد
  if (userId === adminId) {
    return next(done);
  }
  
  const now = Date.now();
  const userCooldown = cooldowns.get(userId);
  
  // أول رسالة من المستخدم
  if (!userCooldown) {
    cooldowns.set(userId, { count: 1, firstMessage: now });
    return next(done);
  }
  
  // إذا مرت 24 ساعة، إعادة تعيين العداد
  if (now - userCooldown.firstMessage > COOLDOWN_TIME) {
    cooldowns.set(userId, { count: 1, firstMessage: now });
    return next(done);
  }
  
  // إذا وصل للحد الأقصى (10 رسائل)
  if (userCooldown.count >= MESSAGE_LIMIT) {
    // حساب الوقت المتبقي بالساعات
    const remainingMs = COOLDOWN_TIME - (now - userCooldown.firstMessage);
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.ceil((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeMessage = '';
    if (remainingHours > 0) {
      timeMessage = `${remainingHours} ساعة`;
      if (remainingMinutes > 0) {
        timeMessage += ` و ${remainingMinutes} دقيقة`;
      }
    } else {
      timeMessage = `${remainingMinutes} دقيقة`;
    }
    
    context.response.reply(
      `⏳ *لقد استنفدت رسائلك اليومية*\n\n` +
      `📊 الحد المسموح: ${MESSAGE_LIMIT} رسائل كل 24 ساعة\n` +
      `⏰ يمكنك الإرسال مجدداً بعد: ${timeMessage}\n\n` +
      `💡 سيتم إعادة تعيين العداد تلقائياً`
    );
    return done();
  }
  
  // زيادة عداد الرسائل
  userCooldown.count++;
  
  // إشعار تحذيري عند الاقتراب من الحد
  if (userCooldown.count === MESSAGE_LIMIT - 2) {
    context.response.send(`⚠️ تبقى لك ${MESSAGE_LIMIT - userCooldown.count} رسائل فقط لليوم`);
  }
  
  next(done);
});

// معالجة إشارات الإيقاف
const shutdown = () => {
  robot.logger.info('🛑 Shutting down...');
  robot.shutdown();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (err) => {
  robot.logger.error(`Uncaught exception: ${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  robot.logger.error(`Unhandled rejection at ${promise}: ${reason}`);
});

// منع النوم على Render - Self Ping (قبل التشغيل)
if (process.env.RENDER_EXTERNAL_URL) {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  
  setInterval(() => {
    robot.http(`${RENDER_URL}/hubot/ping`)
      .get()((err, res, body) => {
        if (!err && res.statusCode === 200) {
          robot.logger.debug('✅ Keep-alive ping successful');
        } else {
          robot.logger.debug('⚠️ Keep-alive ping failed');
        }
      });
  }, 14 * 60 * 1000); // كل 14 دقيقة
  
  robot.logger.info('🔄 Keep-alive system activated');
  robot.logger.info(`🌐 URL: ${RENDER_URL}`);
}

// تشغيل البوت
robot.run();

robot.logger.info('🚀 Hubot is running!');
robot.logger.info(`📛 Name: ${robot.name}`);
robot.logger.info(`🔢 Version: ${robot.version}`);
robot.logger.info(`⏳ Cooldown: 10 messages per 24 hours`);

module.exports = robot;
