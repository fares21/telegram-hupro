const EventEmitter = require('eventemitter3');
const Brain = require('./brain');
const Response = require('./response');
const Listener = require('./listener');
const { TextMessage, EnterMessage, LeaveMessage, TopicMessage } = require('./message');
const Middleware = require('./middleware');
const fs = require('fs');
const path = require('path');
const Log = require('log');

class Robot extends EventEmitter {
  constructor(adapterPath, adapter, httpd, name, alias) {
    super();
    
    this.name = name || 'Hubot';
    this.alias = alias;
    this.events = new EventEmitter();
    this.brain = new Brain(this);
    this.adapter = null;
    this.Response = Response;
    this.commands = [];
    this.listeners = [];
    this.middleware = {
      listener: new Middleware(this),
      response: new Middleware(this),
      receive: new Middleware(this)
    };
    this.logger = new Log(process.env.HUBOT_LOG_LEVEL || 'info');
    this.pingIntervalId = null;
    this.globalHttpOptions = {};
    
    this.parseVersion();
    
    if (httpd) {
      this.setupExpress();
    }
    
    this.setupNullAdapter();
    this.loadAdapter(adapterPath, adapter);
  }

  // إعداد Express للـ HTTP endpoints
  setupExpress() {
    const express = require('express');
    
    this.router = express();
    this.router.use(express.json());
    this.router.use(express.urlencoded({ extended: true }));
    
    const port = process.env.EXPRESS_PORT || process.env.PORT || 8080;
    const host = process.env.EXPRESS_BIND_ADDRESS || process.env.BIND_ADDRESS || '0.0.0.0';
    
    this.server = this.router.listen(port, host, () => {
      this.logger.info(`🌐 HTTP Server listening on ${host}:${port}`);
    });
    
    this.router.get('/hubot/ping', (req, res) => res.send('PONG'));
  }

  // تحميل المحول (Adapter)
  loadAdapter(adapterPath, adapter) {
    this.logger.info(`📡 Loading adapter: ${adapter}`);
    
    try {
      const AdapterClass = require(adapterPath);
      this.adapter = new AdapterClass(this);
    } catch (err) {
      this.logger.error(`Cannot load adapter ${adapter}: ${err}`);
      process.exit(1);
    }
  }

  // محول افتراضي
  setupNullAdapter() {
    this.on('error', (err) => {
      this.logger.error(err.stack || err.toString());
    });
  }

  // نظام الاستماع الكامل
  hear(regex, options, callback) {
    return this.listen(this.createMatcher(regex), options, callback);
  }

  respond(regex, options, callback) {
    const matcher = this.createMatcher(regex);
    
    return this.listen((message) => {
      if (message instanceof TextMessage) {
        const robotName = this.name;
        const robotAlias = this.alias;
        
        // التحقق من ذكر اسم البوت
        const regex = new RegExp(
          `^[@]?${robotName}[:,]?\\s+|^${robotName}[:,]?\\s+` +
          (robotAlias ? `|^[@]?${robotAlias}[:,]?\\s+` : ''),
          'i'
        );
        
        if (regex.test(message.text)) {
          message.text = message.text.replace(regex, '').trim();
          return matcher(message);
        }
      }
      return false;
    }, options, callback);
  }

  enter(options, callback) {
    return this.listen(
      (msg) => msg instanceof EnterMessage,
      options,
      callback
    );
  }

  leave(options, callback) {
    return this.listen(
      (msg) => msg instanceof LeaveMessage,
      options,
      callback
    );
  }

  topic(options, callback) {
    return this.listen(
      (msg) => msg instanceof TopicMessage,
      options,
      callback
    );
  }

  catchAll(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    return this.listen(() => true, options, callback);
  }

  // نظام الاستماع الرئيسي
  listen(matcher, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const listener = new Listener(this, matcher, options, callback);
    this.listeners.push(listener);
    return listener;
  }

  createMatcher(regex) {
    return (message) => {
      if (message instanceof TextMessage) {
        return message.match(regex);
      }
      return false;
    };
  }

  // استقبال الرسائل
  receive(message, done) {
    if (done == null) {
      done = () => {};
    }

    this.middleware.receive.execute({ response: new Response(this, message) }, (context, middlewareDone) => {
      this.processListeners(context.response.message, (listenerError) => {
        middlewareDone(listenerError);
        done(listenerError);
      });
    }, (error) => {
      this.emit('error', error, new Response(this, message));
      done(error);
    });
  }

  // معالجة المستمعات
  processListeners(message, done) {
    let anyListenersExecuted = false;
    const listenerMiddleware = this.middleware.listener;

    const listenerExecutionLoop = (index) => {
      if (index >= this.listeners.length) {
        if (!anyListenersExecuted) {
          this.logger.debug('No listeners executed');
        }
        return done();
      }

      const listener = this.listeners[index];
      
      try {
        if (listener.matcher(message)) {
          anyListenersExecuted = true;

          const response = new Response(this, message, listener.regex);
          
          listenerMiddleware.execute(
            { listener, response },
            (context, middlewareDone) => {
              listener.callback(context.response);
              middlewareDone();
            },
            (err) => {
              if (err) {
                this.emit('error', err, new Response(this, message));
              }
              listenerExecutionLoop(index + 1);
            }
          );
        } else {
          listenerExecutionLoop(index + 1);
        }
      } catch (err) {
        this.emit('error', err, new Response(this, message));
        listenerExecutionLoop(index + 1);
      }
    };

    listenerExecutionLoop(0);
  }

  // تحميل ملف سكربت
  loadFile(filepath, filename) {
    const full = path.join(filepath, filename);
    
    try {
      const script = require(full);
      
      if (typeof script === 'function') {
        script(this);
        this.parseHelp(full);
      } else {
        this.logger.warning(`Expected ${full} to export a function, got ${typeof script}`);
      }
    } catch (error) {
      this.logger.error(`Unable to load ${full}: ${error.stack}`);
      process.exit(1);
    }
  }

  // تحميل سكربتات
  load(path) {
    this.logger.debug(`Loading scripts from ${path}`);
    
    if (fs.existsSync(path)) {
      const files = fs.readdirSync(path).sort();
      
      files.forEach((file) => {
        if (file.match(/\.(js|mjs|coffee|litcoffee)$/)) {
          this.loadFile(path, file);
        }
      });
    }
  }

  // تحليل وثائق المساعدة
  parseHelp(filepath) {
    const body = fs.readFileSync(filepath, 'utf-8');
    const scriptName = path.basename(filepath);
    const lines = body.split('\n');
    
    lines.forEach((line) => {
      if (line.match(/^#\s+hubot/i) || line.match(/^#\s+@?bot/i)) {
        if (!this.commands.includes(line)) {
          this.commands.push(line.substring(2).trim());
        }
      }
    });
  }

  // تشغيل البوت
  run() {
    this.emit('running');
    this.adapter.run();
  }

  // إيقاف البوت
  shutdown() {
    if (this.pingIntervalId != null) {
      clearInterval(this.pingIntervalId);
    }
    
    this.adapter.close();
    this.brain.close();
    
    if (this.server) {
      this.server.close();
    }
  }

  // إرسال رسالة
  send(envelope, ...strings) {
    return this.adapter.send(envelope, ...strings);
  }

  reply(envelope, ...strings) {
    return this.adapter.reply(envelope, ...strings);
  }

  messageRoom(room, ...strings) {
    const envelope = { room };
    return this.adapter.send(envelope, ...strings);
  }

  // الإصدار
  parseVersion() {
    const pkg = require('../package.json');
    this.version = pkg.version;
    this.logger.info(`🤖 Hubot v${this.version}`);
  }

  // HTTP Client
  http(url, options = {}) {
    const httpClient = require('scoped-http-client').create(url, this.globalHttpOptions);
    
    Object.keys(options).forEach(key => {
      httpClient[key](options[key]);
    });
    
    return httpClient;
  }
}

module.exports = Robot;
