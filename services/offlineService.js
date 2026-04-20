import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';

class OfflineService {
  constructor() {
    this.db = null;
    this.isOnline = true;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      this.db = await SQLite.openDatabaseAsync('compuclass.db');
      await this.createTables();
      this.setupNetworkListener();
      this.initialized = true;
    } catch (error) {
      console.error('OfflineService init error:', error);
    }
  }

  async createTables() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        synced INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS quiz_results (
        id TEXT PRIMARY KEY,
        quiz_id TEXT,
        score INTEGER,
        answers TEXT,
        synced INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS user_progress (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        progress INTEGER,
        synced INTEGER DEFAULT 0
      );
    `);
  }

  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      if (this.isOnline) {
        this.syncPendingData();
      }
    });
  }

  async saveCourse(course) {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT OR REPLACE INTO courses (id, title, content, synced) VALUES (?, ?, ?, ?)',
      [course.id, course.title, JSON.stringify(course.content), 1]
    );
  }

  async getCourses() {
    await this.init();
    if (!this.db) return [];
    const result = await this.db.getAllAsync('SELECT * FROM courses');
    return result.map(row => ({
      ...row,
      content: JSON.parse(row.content)
    }));
  }

  async saveQuizResult(result) {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT INTO quiz_results (id, quiz_id, score, answers, synced) VALUES (?, ?, ?, ?, ?)',
      [result.id, result.quiz_id, result.score, JSON.stringify(result.answers), this.isOnline ? 1 : 0]
    );
  }

  async syncPendingData() {
    await this.init();
    if (!this.db) return;
    // Sync unsynced quiz results
    const unsyncedResults = await this.db.getAllAsync(
      'SELECT * FROM quiz_results WHERE synced = 0'
    );
    
    for (const result of unsyncedResults) {
      try {
        // Sync to Supabase here
        await this.db.runAsync(
          'UPDATE quiz_results SET synced = 1 WHERE id = ?',
          [result.id]
        );
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }
}

export const offlineService = new OfflineService();