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
    this.isLoaded = false;
    
    // ضمان وجود المجلد
    const dir = path.dirname(this.savePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        this.log('info', `📁 Created data directory: ${dir}`);
      } catch (error) {
        this.log('error', `Failed to create directory ${dir}: ${error.message}`);
      }
    }
    
    // ⚠️ لا نستدعي load() هنا!
    // سيتم استدعاؤه من robot.js بعد تهيئة logger
    
    // الاستماع لحدث running
    this.robot.on('running', () => {
      if (this.isLoaded) {
        this.emit('loaded', this.data);
      }
    });
  }

  // ✅ وظيفة التهيئة المتأخرة
  init() {
    this.load();
    this.setupAutoSave();
    this.isLoaded = true;
  }

  // مساعد للـ logging
  log(level, message) {
    if (this.robot && this.robot.logger) {
      this.robot.logger[level](message);
    } else {
      // Fallback لـ console
      console[level === 'debug' ? 'log' : level](message);
    }
  }

  // حفظ البيانات
  save() {
    try {
      // التأكد من وجود المجلد
      const dir = path.dirname(this.savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // حفظ البيانات
      fs.writeFileSync(this.savePath, JSON.stringify(this.data, null, 2), 'utf8');
      this.log('debug', '💾 Brain saved successfully');
      this.emit('saved', this.data);
      
      return true;
    } catch (error) {
      this.log('error', `❌ Error saving brain: ${error.message}`);
      this.emit('error', error);
      return false;
    }
  }

  // حفظ متزامن (للاستخدام الفوري)
  saveSync() {
    return this.save();
  }

  // تحميل البيانات
  load() {
    if (fs.existsSync(this.savePath)) {
      try {
        const rawData = fs.readFileSync(this.savePath, 'utf-8');
        
        // التحقق من أن الملف ليس فارغاً
        if (!rawData || rawData.trim() === '') {
          this.log('warning', '⚠️ Brain file is empty, initializing fresh data');
          this.data = { users: {}, _private: {} };
          return;
        }
        
        const parsedData = JSON.parse(rawData);
        
        // التحقق من البنية الصحيحة
        if (parsedData && typeof parsedData === 'object') {
          this.data = parsedData;
          
          // التأكد من وجود المفاتيح الأساسية
          if (!this.data.users) {
            this.data.users = {};
          }
          if (!this.data._private) {
            this.data._private = {};
          }
          
          const userCount = Object.keys(this.data.users).length;
          this.log('info', `🧠 Brain loaded: ${userCount} users`);
          this.emit('loaded', this.data);
        } else {
          throw new Error('Invalid brain data structure');
        }
      } catch (error) {
        this.log('error', `❌ Error loading brain: ${error.message}`);
        this.log('warning', '⚠️ Initializing fresh brain data');
        
        // تهيئة بيانات فارغة في حالة الخطأ
        this.data = { users: {}, _private: {} };
        
        // حفظ البيانات الفارغة
        this.save();
      }
    } else {
      this.log('info', '🧠 Brain initialized (no saved data found)');
      this.data = { users: {}, _private: {} };
      
      // حفظ الملف الأولي
      this.save();
    }
  }

  // إعادة التحميل من القرص
  reload() {
    this.log('info', '🔄 Reloading brain from disk...');
    this.load();
  }

  // إعداد الحفظ التلقائي
  setupAutoSave() {
    if (this.autoSave) {
      this.autoSaveInterval = setInterval(() => {
        this.save();
      }, this.saveInterval * 60 * 1000);
      
      this.log('info', `⏰ Auto-save enabled: every ${this.saveInterval} minutes`);
    }
  }

  // إيقاف الحفظ التلقائي
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      this.log('info', '⏰ Auto-save disabled');
    }
  }

  // الحصول على/تعيين قيمة
  set(key, value) {
    if (key === 'users' || key === '_private') {
      throw new Error(`Forbidden key: ${key}`);
    }
    
    const oldValue = this.data[key];
    this.data[key] = value;
    this.emit('set', key, value, oldValue);
    
    return this;
  }

  get(key) {
    return this.data[key];
  }

  remove(key) {
    if (key === 'users' || key === '_private') {
      throw new Error(`Cannot remove protected key: ${key}`);
    }
    
    if (this.data[key] != null) {
      const oldValue = this.data[key];
      delete this.data[key];
      this.emit('remove', key, oldValue);
    }
    
    return this;
  }

  // التحقق من وجود مفتاح
  has(key) {
    return this.data.hasOwnProperty(key);
  }

  // الحصول على جميع المفاتيح
  keys() {
    return Object.keys(this.data).filter(k => k !== 'users' && k !== '_private');
  }

  // مسح البيانات المخصصة (ليس المستخدمين)
  reset() {
    const users = this.data.users;
    const privateData = this.data._private;
    
    this.data = {
      users: users,
      _private: privateData
    };
    
    this.emit('reset');
    this.save();
    
    return this;
  }

  // إدارة المستخدمين
  userForId(id, options = {}) {
    // تحويل id لنص للتوافق
    const userId = String(id);
    
    let user = this.data.users[userId];
    
    if (!user) {
      user = { id: userId, ...options };
      this.data.users[userId] = user;
      
      this.log('debug', `👤 New user created: ${userId}`);
      this.emit('user_created', user);
    } else {
      // تحديث الخيارات الموجودة
      let updated = false;
      Object.keys(options).forEach(key => {
        if (user[key] !== options[key]) {
          user[key] = options[key];
          updated = true;
        }
      });
      
      if (updated) {
        this.emit('user_updated', user);
      }
    }
    
    return user;
  }

  userForName(name) {
    if (!name) return null;
    
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
    if (!fuzzyName) return [];
    
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

  // حذف مستخدم
  removeUser(id) {
    const userId = String(id);
    
    if (this.data.users[userId]) {
      const user = this.data.users[userId];
      delete this.data.users[userId];
      
      this.log('debug', `👤 User removed: ${userId}`);
      this.emit('user_removed', user);
      
      return user;
    }
    
    return null;
  }

  // عدد المستخدمين
  userCount() {
    return Object.keys(this.data.users).length;
  }

  // إغلاق
  close() {
    this.log('info', '🧠 Closing brain...');
    
    // إيقاف الحفظ التلقائي
    this.stopAutoSave();
    
    // حفظ نهائي
    this.save();
    
    // إزالة جميع المستمعين
    this.removeAllListeners();
    
    this.log('info', '🧠 Brain closed');
  }

  // الحصول على جميع المستخدمين
  users() {
    return this.data.users;
  }

  // إحصائيات
  stats() {
    const userCount = this.userCount();
    const dataKeys = this.keys().length;
    const privateKeys = Object.keys(this.data._private || {}).length;
    
    return {
      users: userCount,
      dataKeys: dataKeys,
      privateKeys: privateKeys,
      totalSize: JSON.stringify(this.data).length,
      savePath: this.savePath,
      autoSave: this.autoSave,
      saveInterval: this.saveInterval
    };
  }

  // تصدير البيانات
  export() {
    return JSON.stringify(this.data, null, 2);
  }

  // استيراد البيانات
  import(jsonData) {
    try {
      const importedData = typeof jsonData === 'string' 
        ? JSON.parse(jsonData) 
        : jsonData;
      
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid data format');
      }
      
      // دمج البيانات
      this.data = {
        users: importedData.users || {},
        _private: importedData._private || {},
        ...importedData
      };
      
      this.log('info', '📥 Data imported successfully');
      this.emit('imported', this.data);
      this.save();
      
      return true;
    } catch (error) {
      this.log('error', `❌ Error importing data: ${error.message}`);
      return false;
    }
  }

  // نسخ احتياطي
  backup(backupPath) {
    try {
      const actualBackupPath = backupPath || `${this.savePath}.backup`;
      fs.writeFileSync(actualBackupPath, JSON.stringify(this.data, null, 2), 'utf8');
      
      this.log('info', `💾 Backup created: ${actualBackupPath}`);
      return actualBackupPath;
    } catch (error) {
      this.log('error', `❌ Error creating backup: ${error.message}`);
      return null;
    }
  }

  // استعادة من نسخة احتياطية
  restore(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }
      
      const backupData = fs.readFileSync(backupPath, 'utf-8');
      const parsedData = JSON.parse(backupData);
      
      this.data = parsedData;
      this.save();
      
      this.log('info', `📥 Restored from backup: ${backupPath}`);
      this.emit('restored', this.data);
      
      return true;
    } catch (error) {
      this.log('error', `❌ Error restoring backup: ${error.message}`);
      return false;
    }
  }
}

module.exports = Brain;
