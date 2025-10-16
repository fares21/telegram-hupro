// Description:
//   أدوات الإدارة المتقدمة
//
// Commands:
//   hubot brain save - حفظ الذاكرة يدوياً (إدمن فقط)
//   hubot brain stats - إحصائيات الذاكرة (إدمن فقط)
//   hubot shutdown - إيقاف البوت (إدمن فقط)

module.exports = (robot) => {
  robot.respond(/brain save$/i, { adminOnly: true }, (res) => {
    robot.brain.save();
    res.reply('💾 تم حفظ الذاكرة بنجاح');
  });

  robot.respond(/brain stats$/i, { adminOnly: true }, (res) => {
    const users = Object.keys(robot.brain.users()).length;
    const dataKeys = Object.keys(robot.brain.data).length;
    const privateKeys = Object.keys(robot.brain.data._private || {}).length;
    
    const stats = 
      `🧠 *إحصائيات الذاكرة:*\n\n` +
      `👥 المستخدمون: ${users}\n` +
      `🔑 مفاتيح البيانات: ${dataKeys}\n` +
      `🔒 مفاتيح خاصة: ${privateKeys}\n` +
      `📁 مسار الحفظ: ${robot.brain.savePath}`;
    
    res.send(stats);
  });

  robot.respond(/shutdown$/i, { adminOnly: true }, (res) => {
    res.reply('👋 جاري الإيقاف...');
    
    setTimeout(() => {
      robot.shutdown();
      process.exit(0);
    }, 1000);
  });

  robot.respond(/reload scripts$/i, { adminOnly: true }, (res) => {
    res.reply('⚠️ إعادة تحميل السكربتات يتطلب إعادة تشغيل البوت');
  });
};
