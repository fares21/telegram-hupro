const { TextMessage } = require('./message');

class Response {
  constructor(robot, message, match) {
    this.robot = robot;
    this.message = message;
    this.match = match;
    this.envelope = {
      room: message.room,
      user: message.user,
      message: message
    };
  }

  // إرسال رسائل
  send(...strings) {
    return this.robot.adapter.send(this.envelope, ...strings);
  }

  emote(...strings) {
    return this.robot.adapter.emote(this.envelope, ...strings);
  }

  reply(...strings) {
    return this.robot.adapter.reply(this.envelope, ...strings);
  }

  topic(...strings) {
    return this.robot.adapter.topic(this.envelope, ...strings);
  }

  play(...strings) {
    return this.robot.adapter.play(this.envelope, ...strings);
  }

  locked(...strings) {
    return this.robot.adapter.locked(this.envelope, ...strings);
  }

  // رد عشوائي
  random(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  // إنهاء المعالجة
  finish() {
    this.message.finish = true;
  }

  // HTTP Client
  http(url, options) {
    return this.robot.http(url, options);
  }
}

module.exports = Response;
