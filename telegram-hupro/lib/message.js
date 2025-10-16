class Message {
  constructor(user, done) {
    this.user = user;
    this.done = done || false;
    this.room = user.room;
  }

  finish() {
    this.done = true;
  }
}

class TextMessage extends Message {
  constructor(user, text, id) {
    super(user);
    this.text = text;
    this.id = id;
  }

  match(regex) {
    return this.text.match(regex);
  }

  toString() {
    return this.text;
  }
}

class EnterMessage extends Message {
  constructor(user, text, id) {
    super(user);
    this.text = text;
    this.id = id;
  }
}

class LeaveMessage extends Message {
  constructor(user, text, id) {
    super(user);
    this.text = text;
    this.id = id;
  }
}

class TopicMessage extends Message {
  constructor(user, text, id) {
    super(user);
    this.text = text;
    this.id = id;
  }
}

class CatchAllMessage extends Message {
  constructor(message) {
    super(message.user);
    this.message = message;
  }
}

module.exports = {
  Message,
  TextMessage,
  EnterMessage,
  LeaveMessage,
  TopicMessage,
  CatchAllMessage
};
