// Description:
//   نظام المساعدة الكامل
//
// Commands:
//   hubot help - عرض جميع الأوامر المتاحة
//   hubot help <query> - البحث في الأوامر

module.exports = (robot) => {
  robot.respond(/help\s*(.*)?$/i, (res) => {
    const query = res.match[1];
    
    if (query) {
      // البحث في الأوامر
      const commands = robot.commands.filter(cmd => 
        cmd.toLowerCase().includes(query.toLowerCase())
      );
      
      if (commands.length === 0) {
        return res.reply(`لم أجد أوامر تحتوي على: ${query}`);
      }
      
      const help = `🔍 *نتائج البحث عن "${query}":*\n\n` +
        commands.map(cmd => `• ${cmd}`).join('\n');
      
      return res.send(help);
    }
    
    // عرض جميع الأوامر
    if (robot.commands.length === 0) {
      return res.send('⚠️ لا توجد أوامر متاحة حالياً');
    }
    
    const help = `📖 *الأوامر المتاحة:*\n\n` +
      robot.commands.map(cmd => `• ${cmd}`).join('\n') +
      `\n\n💡 استخدم \`help <كلمة>\` للبحث في الأوامر`;
    
    res.send(help);
  });

  // أمر /commands كبديل
  robot.hear(/^\/commands?$/i, (res) => {
    if (robot.commands.length === 0) {
      return res.send('⚠️ لا توجد أوامر متاحة حالياً');
    }
    
    const commandsList = robot.commands
      .map((cmd, i) => `${i + 1}. ${cmd}`)
      .join('\n');
    
    res.send(`📋 *قائمة الأوامر الكاملة:*\n\n${commandsList}`);
  });
};
