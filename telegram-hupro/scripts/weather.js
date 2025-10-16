// Description:
//   معلومات الطقس الفورية
//
// Commands:
//   hubot weather <city> - حالة الطقس لمدينة معينة

const axios = require('axios');

module.exports = (robot) => {
  robot.respond(/weather (.+)$/i, async (res) => {
    const city = res.match[1];
    
    res.send('⏳ جاري جلب بيانات الطقس...');
    
    try {
      const response = await axios.get(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { timeout: 10000 }
      );
      
      const weather = response.data;
      const current = weather.current_condition[0];
      const location = weather.nearest_area[0];
      
      const message = 
        `☁️ *الطقس في ${city}*\n\n` +
        `🌡️ درجة الحرارة: ${current.temp_C}°C (يبدو ${current.FeelsLikeC}°C)\n` +
        `💨 الرياح: ${current.windspeedKmph} كم/س ${current.winddir16Point}\n` +
        `💧 الرطوبة: ${current.humidity}%\n` +
        `👁️ الرؤية: ${current.visibility} كم\n` +
        `☁️ الغيوم: ${current.cloudcover}%\n` +
        `🌤️ الحالة: ${current.weatherDesc[0].value}\n` +
        `📍 الموقع: ${location.areaName[0].value}, ${location.country[0].value}`;
      
      res.send(message);
    } catch (error) {
      robot.logger.error(`Weather API error: ${error.message}`);
      res.reply('❌ عذرًا، لم أتمكن من جلب بيانات الطقس. تأكد من اسم المدينة.');
    }
  });
};
