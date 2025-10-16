const EventEmitter = require('eventemitter3');
const fs = require('fs');
const path = require('path');

class Brain extends EventEmitter {
  constructor(robot) {
    super();
    
    this.robot = robot;
    this.data = {
      users: {},
      _private: {}
    };
    this.autoSave = true;
    this.saveInterval = 5; // دقائق
    this.savePath = process.env.BRAIN_PATH || './data/brain.json';
    
    // ضمان وجود المجلد
    const dir = path.dirname(this.savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // ⚠️ لا تستدعي load() هنا!
    // سنستدعيها بعد تهيئة robot.logger
    
    this.robot.on('running', () => {
      this.emit('loaded', this.data);
    });
  }

  // وظيفة التهيئة المتأخرة
  init() {
    this.load();
    this.setupAutoSave();
  }

  // حفظ البيانات
  save() {
    try {
      fs.writeFileSync(this.savePath, JSON.stringify(this.data, null, 2));
      // تحقق من وجود logger قبل الاستخدام
      if (this.robot && this.robot.logger) {
        this.robot.logger.debug('💾 Brain saved');
      }
    } catch (error) {
      if (this.robot && this.robot.logger) {
        this.robot.logger.error(`Error saving brain: ${error}`);
      } else {
        console.error(`Error saving brain: ${error}`);
      }
    }
  }

  // تحميل البيانات
  load() {
    if (fs.existsSync(this.savePath)) {
      try {
        const data = fs.readFileSync(this.savePath, 'utf-8');
        this.data = JSON.parse(data);
        
        if (this.robot && this.robot.logger) {
          this.robot.logger.info('🧠 Brain loaded');
        } else {
          console.log('🧠 Brain loaded');
        }
      } catch (error) {
        if (this.robot && this.robot.logger) {
          this.robot.logger.error(`Error loading brain: ${error}`);
        } else {
          console.error(`Error loading brain: ${error}`);
        }
        // تهيئة بيانات فارغة في حالة الخطأ
        this.data = { users: {}, _private: {} };
      }
    } else {
      if (this.robot && this.robot.logger) {
        this.robot.logger.info('🧠 Brain initialized (no saved data)');
      } else {
        console.log('🧠 Brain initialized (no saved data)');
      }
    }
  }

  // إعداد الحفظ التلقائي
  setupAutoSave() {
    if (this.autoSave) {
      setInterval(() => {
        this.save();
      }, this.saveInterval * 60 * 1000);
    }
  }

  // الحصول على/تعيين قيمة
  set(key, value) {
    if (key === 'users' || key === '_private') {
      throw new Error(`Forbidden key: ${key}`);
    }
    this.data[key] = value;
    this.emit('set', key, value);
    return this;
  }

  get(key) {
    return this.data[key];
  }

  remove(key) {
    if (this.data[key] != null) {
      delete this.data[key];
      this.emit('remove', key);
    }
    return this;
  }

  // إدارة المستخدمين
  userForId(id, options = {}) {
    let user = this.data.users[id];
    
    if (!user) {
      user = { id, ...options };
      this.data.users[id] = user;
    }
    
    // تحديث الخيارات
    Object.keys(options).forEach(key => {
      user[key] = options[key];
    });
    
    this.emit('user_created', user);
    return user;
  }

  userForName(name) {
    const lowerName = name.toLowerCase();
    
    for (const userId in this.data.users) {
      const user = this.data.users[userId];
      if (user.name && user.name.toLowerCase() === lowerName) {
        return user;
      }
    }
    
    return null;
  }

  usersForFuzzyName(fuzzyName) {
    const lowerFuzzyName = fuzzyName.toLowerCase();
    const users = [];
    
    for (const userId in this.data.users) {
      const user = this.data.users[userId];
      if (user.name && user.name.toLowerCase().includes(lowerFuzzyName)) {
        users.push(user);
      }
    }
    
    return users;
  }

  // إغلاق
  close() {
    this.save();
    this.removeAllListeners();
  }

  // الحصول على جميع المستخدمين
  users() {
    return this.data.users;
  }
}

module.exports = Brain;
