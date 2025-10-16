// Description:
//   نظام الإرسال الجماعي الاحترافي
//
// Commands:
//   hubot broadcast <message> - إرسال رسالة لجميع المستخدمين (إدمن فقط)
//   hubot stats - عرض إحصائيات المستخدمين

module.exports = (robot) => {
  const ADMIN_ID = parseInt(process.env.ADMIN_ID);

  robot.respond(/broadcast (.+)$/i, { adminOnly: true }, async (res) => {
    const message = res.match[1];
    const users = robot.brain.users();
    const userIds = Object.keys(users);
    
    if (userIds.length === 0) {
      return res.reply('⚠️ لا يوجد مستخدمون لإرسال الرسالة إليهم');
    }
    
    res.send(`📤 جاري الإرسال إلى ${userIds.length} مستخدم...`);
    
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();
    
    for (const userId of userIds) {
      try {
        const user = users[userId];
        const envelope = { room: user.room, user: user };
        
        robot.send(envelope, `📢 *إشعار من الإدارة:*\n\n${message}`);
        successCount++;
        
        // تأخير 200ms بين كل إرسال
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        failCount++;
        robot.logger.error(`فشل الإرسال لـ ${userId}: ${error.message}`);
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.send(
      `✅ *تم الإرسال الجماعي*\n\n` +
      `✔️ نجح: ${successCount}\n` +
      `❌ فشل: ${failCount}\n` +
      `📊 الإجمالي: ${userIds.length}\n` +
      `⏱️ المدة: ${duration} ثانية`
    );
  });

  robot.respond(/stats$/i, (res) => {
    const users = robot.brain.users();
    const userIds = Object.keys(users);
    const totalUsers = userIds.length;
    
    // حساب المستخدمين الجدد اليوم
    const today = new Date().toISOString().split('T')[0];
    const newToday = userIds.filter(id => {
      const user = users[id];
      return user.created_at && user.created_at.startsWith(today);
    }).length;
    
    // حساب uptime
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const stats = 
      `📊 *إحصائيات البوت*\n\n` +
      `👥 إجمالي المستخدمين: ${totalUsers}\n` +
      `🆕 انضموا اليوم: ${newToday}\n` +
      `⏰ وقت التشغيل: ${hours}س ${minutes}د\n` +
      `🧠 حجم الذاكرة: ${Object.keys(robot.brain.data).length} مفاتيح\n` +
      `📅 التاريخ: ${new Date().toLocaleString('ar-DZ')}`;
    
    res.send(stats);
  });

  // حفظ وقت إنشاء المستخدم
  robot.brain.on('user_created', (user) => {
    user.created_at = new Date().toISOString();
  });
};
