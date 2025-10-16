// Description:
//   فحص استجابة البوت
//
// Commands:
//   hubot ping - فحص استجابة البوت
//   hubot echo <text> - تكرار النص
//   hubot time - الوقت الحالي

module.exports = (robot) => {
  robot.respond(/ping$/i, (res) => {
    res.send('🏓 PONG!');
  });

  robot.respond(/echo (.+)$/i, (res) => {
    res.send(res.match[1]);
  });

  robot.respond(/time$/i, (res) => {
    const now = new Date();
    const timeString = now.toLocaleString('ar-DZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Africa/Algiers'
    });
    
    res.send(`🕐 *الوقت الحالي:*\n${timeString}`);
  });

  robot.respond(/adapter$/i, (res) => {
    res.send(`🔌 Adapter: ${robot.adapterName || 'telegram'}`);
  });
};
