class Listener {
  constructor(robot, matcher, options, callback) {
    this.robot = robot;
    this.matcher = matcher;
    this.options = options;
    this.callback = callback;
    
    if (this.matcher instanceof RegExp) {
      this.regex = this.matcher;
      this.matcher = (message) => {
        if (message.text != null) {
          return message.text.match(this.regex);
        }
        return false;
      };
    }
  }

  call(message, middleware, cb) {
    if (this.matcher(message)) {
      if (middleware != null) {
        middleware.execute({ listener: this, response: message }, cb);
      } else {
        this.callback(message);
        cb();
      }
      return true;
    }
    return false;
  }
}

module.exports = Listener;
