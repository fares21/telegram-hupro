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
    
    // ✅ إنشاء logger أولاً قبل أي شيء
    this.logger = new Log(process.env.HUBOT_LOG_LEVEL || 'info');
    
    // ✅ ثم Brain (بدون تحميل فوري)
    this.brain = new Brain(this);
    
    this.Response = Response;
    this.commands = [];
    this.listeners = [];
    this.middleware = {
      listener: new Middleware(this),
      response: new Middleware(this),
      receive: new Middleware(this)
    };
    this.pingIntervalId = null;
    this.globalHttpOptions = {};
    
    this.parseVersion();
    
    if (httpd) {
      this.setupExpress();
    }
    
    this.setupNullAdapter();
    this.loadAdapter(adapterPath, adapter);
    
    // ✅ تهيئة Brain بعد تجهيز كل شيء
    this.brain.init();
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
    
    // Health check endpoint
    this.router.get('/', (req, res) => {
      res.json({
        status: 'ok',
        name: this.name,
        version: this.version,
        uptime: process.uptime()
      });
    });
    
    this.router.get('/hubot/ping', (req, res) => {
      res.send('PONG');
    });
    
    // Status endpoint
    this.router.get('/hubot/status', (req, res) => {
      const users = Object.keys(this.brain.users()).length;
      res.json({
        name: this.name,
        version: this.version,
        uptime: process.uptime(),
        users: users,
        listeners: this.listeners.length,
        memory: process.memoryUsage()
      });
    });
  }

  // تحميل المحول (Adapter)
  loadAdapter(adapterPath, adapter) {
    this.logger.info(`📡 Loading adapter: ${adapter}`);
    
    try {
      const AdapterClass = require(adapterPath);
      this.adapter = new AdapterClass(this);
      this.adapterName = adapter;
    } catch (err) {
      this.logger.error(`Cannot load adapter ${adapter}: ${err.message}`);
      this.logger.error(err.stack);
      process.exit(1);
    }
  }

  // محول افتراضي
  setupNullAdapter() {
    this.on('error', (err, res) => {
      this.logger.error(err.stack || err.toString());
      
      if (res && res.message && res.message.user) {
        this.logger.error(`Error happened for user: ${res.message.user.name}`);
      }
    });
  }

  // نظام الاستماع الكامل
  hear(regex, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    return this.listen(this.createMatcher(regex), options, callback);
  }

  respond(regex, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    const matcher = this.createMatcher(regex);
    
    return this.listen((message) => {
      if (message instanceof TextMessage) {
        const robotName = this.name;
        const robotAlias = this.alias;
        
        // التحقق من ذكر اسم البوت
        let mentionRegex;
        if (robotAlias) {
          mentionRegex = new RegExp(
            `^[@]?${robotName}[:,]?\\s+|^${robotName}[:,]?\\s+|^[@]?${robotAlias}[:,]?\\s+|^${robotAlias}[:,]?\\s+`,
            'i'
          );
        } else {
          mentionRegex = new RegExp(
            `^[@]?${robotName}[:,]?\\s+|^${robotName}[:,]?\\s+`,
            'i'
          );
        }
        
        if (mentionRegex.test(message.text)) {
          message.text = message.text.replace(mentionRegex, '').trim();
          return matcher(message);
        }
      }
      return false;
    }, options, callback);
  }

  enter(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    return this.listen(
      (msg) => msg instanceof EnterMessage,
      options,
      callback
    );
  }

  leave(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    return this.listen(
      (msg) => msg instanceof LeaveMessage,
      options,
      callback
    );
  }

  topic(options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
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
    
    if (!callback) {
      throw new Error('Callback is required for listener');
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

    this.middleware.receive.execute(
      { response: new Response(this, message) }, 
      (context, middlewareDone) => {
        this.processListeners(context.response.message, (listenerError) => {
          middlewareDone(listenerError);
          done(listenerError);
        });
      }, 
      (error) => {
        this.emit('error', error, new Response(this, message));
        done(error);
      }
    );
  }

  // معالجة المستمعات
  processListeners(message, done) {
    if (message.done) {
      return done();
    }
    
    let anyListenersExecuted = false;
    const listenerMiddleware = this.middleware.listener;

    const listenerExecutionLoop = (index) => {
      if (index >= this.listeners.length) {
        if (!anyListenersExecuted) {
          this.logger.debug('No listeners executed for message');
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
              try {
                listener.callback(context.response);
                middlewareDone();
              } catch (err) {
                this.logger.error(`Error in listener callback: ${err.message}`);
                this.emit('error', err, context.response);
                middlewareDone(err);
              }
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
        this.logger.error(`Error matching listener: ${err.message}`);
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
      // حذف من الكاش للسماح بإعادة التحميل
      delete require.cache[require.resolve(full)];
      
      const script = require(full);
      
      if (typeof script === 'function') {
        script(this);
        this.parseHelp(full);
        this.logger.info(`  ✅ ${filename}`);
      } else {
        this.logger.warning(`Expected ${full} to export a function, got ${typeof script}`);
      }
    } catch (error) {
      this.logger.error(`  ❌ ${filename}: ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  // تحميل سكربتات
  load(scriptsPath) {
    this.logger.info(`📦 Loading scripts from ${scriptsPath}`);
    
    if (!fs.existsSync(scriptsPath)) {
      this.logger.warning(`Scripts path does not exist: ${scriptsPath}`);
      return;
    }
    
    try {
      const files = fs.readdirSync(scriptsPath).sort();
      
      files.forEach((file) => {
        if (file.match(/\.(js|mjs)$/)) {
          this.loadFile(scriptsPath, file);
        }
      });
    } catch (error) {
      this.logger.error(`Error loading scripts: ${error.message}`);
    }
  }

  // تحليل وثائق المساعدة
  parseHelp(filepath) {
    try {
      const body = fs.readFileSync(filepath, 'utf-8');
      const scriptName = path.basename(filepath);
      const lines = body.split('\n');
      
      lines.forEach((line) => {
        const cleanLine = line.trim();
        
        // البحث عن تعليقات المساعدة
        if (cleanLine.match(/^\/\/\s*hubot/i) || 
            cleanLine.match(/^#\s*hubot/i) ||
            cleanLine.match(/^\/\/\s*Commands:/i)) {
          
          const helpText = cleanLine.replace(/^\/\/\s*/, '').replace(/^#\s*/, '').trim();
          
          if (helpText && !this.commands.includes(helpText)) {
            this.commands.push(helpText);
          }
        }
      });
    } catch (error) {
      this.logger.debug(`Could not parse help from ${filepath}`);
    }
  }

  // تشغيل البوت
  run() {
    this.emit('running');
    
    if (this.adapter && typeof this.adapter.run === 'function') {
      this.adapter.run();
    } else {
      this.logger.error('Adapter does not have a run method');
      process.exit(1);
    }
  }

  // إيقاف البوت
  shutdown() {
    this.logger.info('🛑 Shutting down...');
    
    if (this.pingIntervalId != null) {
      clearInterval(this.pingIntervalId);
    }
    
    if (this.adapter && typeof this.adapter.close === 'function') {
      this.adapter.close();
    }
    
    if (this.brain) {
      this.brain.close();
    }
    
    if (this.server) {
      this.server.close(() => {
        this.logger.info('HTTP server closed');
      });
    }
    
    this.emit('shutdown');
  }

  // إرسال رسائل
  send(envelope, ...strings) {
    if (this.adapter && typeof this.adapter.send === 'function') {
      return this.adapter.send(envelope, ...strings);
    } else {
      this.logger.error('Adapter does not have a send method');
    }
  }

  reply(envelope, ...strings) {
    if (this.adapter && typeof this.adapter.reply === 'function') {
      return this.adapter.reply(envelope, ...strings);
    } else {
      this.logger.error('Adapter does not have a reply method');
    }
  }

  messageRoom(room, ...strings) {
    const envelope = { room };
    return this.send(envelope, ...strings);
  }

  // الإصدار
  parseVersion() {
    try {
      const pkg = require('../package.json');
      this.version = pkg.version;
      this.logger.info(`🤖 Hubot v${this.version}`);
    } catch (error) {
      this.version = '1.0.0';
      this.logger.warning('Could not read version from package.json');
    }
  }

  // HTTP Client
  http(url, options = {}) {
    try {
      const httpClient = require('scoped-http-client').create(url, this.globalHttpOptions);
      
      Object.keys(options).forEach(key => {
        if (typeof httpClient[key] === 'function') {
          httpClient[key](options[key]);
        }
      });
      
      return httpClient;
    } catch (error) {
      this.logger.error(`HTTP client error: ${error.message}`);
      
      // Fallback بسيط
      return {
        get: (callback) => {
          const axios = require('axios');
          axios.get(url, options)
            .then(response => callback(null, response, response.data))
            .catch(err => callback(err, null, null));
        }
      };
    }
  }
}

module.exports = Robot;
