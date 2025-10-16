// Description:
//   نظام الأسئلة الشائعة بالأزرار
//
// Commands:
//   hubot faq - عرض الأسئلة الشائعة
//   /faq - عرض الأسئلة الشائعة

const fs = require('fs');
const path = require('path');

module.exports = (robot) => {
  const faqPath = path.join(__dirname, '..', 'faq.json');
  
  let faqData = [];
  
  // تحميل FAQ
  if (fs.existsSync(faqPath)) {
    try {
      faqData = JSON.parse(fs.readFileSync(faqPath, 'utf-8'));
      robot.logger.info(`📋 Loaded ${faqData.length} FAQ items`);
    } catch (err) {
      robot.logger.error(`Error loading FAQ: ${err}`);
    }
  }

  // أمر FAQ
  robot.respond(/faq$/i, (res) => {
    showFAQ(res);
  });

  robot.hear(/^\/faq$/i, (res) => {
    showFAQ(res);
  });

  // معالجة الضغط على الأزرار
  robot.hear(/^faq_(.+)$/, (res) => {
    const faqId = res.match[1];
    const faqItem = faqData.find(item => item.id === faqId);
    
    if (faqItem) {
      res.send(`❓ *${faqItem.question}*\n\n${faqItem.answer}`);
    }
  });

  function showFAQ(res) {
    if (faqData.length === 0) {
      return res.send('⚠️ لا توجد أسئلة شائعة متاحة حالياً');
    }
    
    const buttons = faqData.map(item => [{
      text: item.question,
      callback_data: `faq_${item.id}`
    }]);
    
    robot.adapter.sendInlineKeyboard(
      res.message.user.room,
      '📋 *الأسئلة الشائعة*\n\nاختر سؤالاً:',
      buttons
    );
  }
};
