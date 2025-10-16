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
    this.saveInterval = 5;
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
    
    this.robot.on('running', () => {
      if (this.isLoaded) {
        this.emit('loaded', this.data);
      }
    });
  }

  init() {
    this.load();
    this.setupAutoSave();
    this.isLoaded = true;
  }

  log(level, message) {
    if (this.robot && this.robot.logger) {
      this.robot.logger[level](message);
    } else {
      console[level === 'debug' ? 'log' : level](message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.savePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
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

  load() {
    if (fs.existsSync(this.savePath)) {
      try {
        const rawData = fs.readFileSync(this.savePath, 'utf-8');
        
        if (!rawData || rawData.trim() === '') {
          this.log('warn', '⚠️ Brain file is empty, initializing fresh data');
          this.data = { users: {}, _private: {} };
          return;
        }
        
        const parsedData = JSON.parse(rawData);
        
        if (parsedData && typeof parsedData === 'object') {
          this.data = parsedData;
          
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
        this.log('warn', '⚠️ Initializing fresh brain data');
        
        this.data = { users: {}, _private: {} };
        this.save();
      }
    } else {
      this.log('info', '🧠 Brain initialized (no saved data found)');
      this.data = { users: {}, _private: {} };
      this.save();
    }
  }

  setupAutoSave() {
    if (this.autoSave) {
      this.autoSaveInterval = setInterval(() => {
        this.save();
      }, this.saveInterval * 60 * 1000);
      
      this.log('info', `⏰ Auto-save enabled: every ${this.saveInterval} minutes`);
    }
  }

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

  userForId(id, options = {}) {
    const userId = String(id);
    
    let user = this.data.users[userId];
    
    if (!user) {
      user = { id: userId, ...options };
      this.data.users[userId] = user;
      
      this.log('debug', `👤 New user created: ${userId}`);
      this.emit('user_created', user);
    } else {
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

  close() {
    this.log('info', '🧠 Closing brain...');
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    this.save();
    this.removeAllListeners();
    
    this.log('info', '🧠 Brain closed');
  }

  users() {
    return this.data.users;
  }
}

module.exports = Brain;
