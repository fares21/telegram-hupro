class Middleware {
  constructor(robot) {
    this.robot = robot;
    this.stack = [];
  }

  register(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this.stack.push(middleware);
  }

  execute(context, next, done) {
    if (done == null) {
      done = () => {};
    }

    let index = 0;
    const executeMiddleware = () => {
      if (index >= this.stack.length) {
        return next(context, done);
      }

      const middleware = this.stack[index++];
      
      try {
        middleware(context, executeMiddleware, (err) => {
          if (err) {
            done(err);
          } else {
            executeMiddleware();
          }
        });
      } catch (err) {
        done(err);
      }
    };

    executeMiddleware();
  }
}

module.exports = Middleware;
