/**
 * SQLite Database Service for Appointment Management
 * Handles appointment storage, retrieval, and rescheduling
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

class SQLiteService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(process.cwd(), 'server', 'data', 'appointments.db');
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize database and create tables if they don't exist
   */
  async initDatabase() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error('[SQLite] Error opening database:', err.message);
            reject(err);
            return;
          }
          console.log('[SQLite] Connected to SQLite database');
          
          // Create appointments table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              user_name TEXT NOT NULL,
              appointment_type TEXT NOT NULL, -- 'home' or 'center'
              center_id TEXT,
              center_name TEXT,
              center_address TEXT,
              appointment_time TEXT NOT NULL,
              appointment_date TEXT NOT NULL,
              status TEXT DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'rescheduled'
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              phone_number TEXT,
              session_id TEXT
            )
          `, (err) => {
            if (err) {
              console.error('[SQLite] Error creating appointments table:', err.message);
              reject(err);
            } else {
              console.log('[SQLite] Appointments table ready');
              resolve();
            }
          });
        });
      });
    } catch (error) {
      console.error('[SQLite] Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Save a new appointment
   */
  async saveAppointment(appointmentData) {
    await this.initPromise;
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      const {
        userId,
        userName,
        appointmentType,
        centerId,
        centerName,
        centerAddress,
        appointmentTime,
        appointmentDate,
        phoneNumber,
        sessionId
      } = appointmentData;

      const sql = `
        INSERT INTO appointments (
          user_id, user_name, appointment_type, center_id, center_name, 
          center_address, appointment_time, appointment_date, phone_number, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        userId,
        userName,
        appointmentType,
        centerId || null,
        centerName || null,
        centerAddress || null,
        appointmentTime,
        appointmentDate || this.getTomorrowDate(),
        phoneNumber || null,
        sessionId || null
      ], function(err) {
        if (err) {
          console.error('[SQLite] Error saving appointment:', err.message);
          reject(err);
        } else {
          console.log(`[SQLite] Appointment saved with ID: ${this.lastID}`);
          resolve({
            success: true,
            appointmentId: this.lastID,
            message: 'Appointment saved successfully'
          });
        }
      });
    });
  }

  /**
   * Get existing appointments for a user
   */
  async getUserAppointments(userId, status = null) {
    await this.initPromise;
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      let sql, params;
      
      if (status) {
        // Filter by specific status
        sql = `
          SELECT * FROM appointments 
          WHERE user_id = ? AND status = ? 
          ORDER BY created_at DESC
        `;
        params = [userId, status];
      } else {
        // Get all active appointments (confirmed or rescheduled)
        sql = `
          SELECT * FROM appointments 
          WHERE user_id = ? AND status IN ('confirmed', 'rescheduled') 
          ORDER BY created_at DESC
        `;
        params = [userId];
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('[SQLite] Error fetching appointments:', err.message);
          reject(err);
        } else {
          console.log(`[SQLite] Found ${rows.length} appointments for user ${userId}`);
          resolve({
            success: true,
            appointments: rows
          });
        }
      });
    });
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId, status) {
    await this.initPromise;
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE appointments 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      this.db.run(sql, [status, appointmentId], function(err) {
        if (err) {
          console.error('[SQLite] Error updating appointment status:', err.message);
          reject(err);
        } else {
          console.log(`[SQLite] Appointment ${appointmentId} status updated to ${status}`);
          resolve({
            success: true,
            changes: this.changes,
            message: `Appointment ${status} successfully`
          });
        }
      });
    });
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(appointmentId, newTime, newDate = null) {
    await this.initPromise;
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE appointments 
        SET appointment_time = ?, 
            appointment_date = COALESCE(?, appointment_date),
            status = 'rescheduled',
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      this.db.run(sql, [newTime, newDate, appointmentId], function(err) {
        if (err) {
          console.error('[SQLite] Error rescheduling appointment:', err.message);
          reject(err);
        } else {
          console.log(`[SQLite] Appointment ${appointmentId} rescheduled to ${newTime}`);
          resolve({
            success: true,
            changes: this.changes,
            message: 'Appointment rescheduled successfully'
          });
        }
      });
    });
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(appointmentId) {
    await this.initPromise;
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM appointments WHERE id = ?`;

      this.db.get(sql, [appointmentId], (err, row) => {
        if (err) {
          console.error('[SQLite] Error fetching appointment:', err.message);
          reject(err);
        } else {
          resolve({
            success: true,
            appointment: row
          });
        }
      });
    });
  }

  /**
   * Check if user has existing appointments
   */
  async hasExistingAppointments(userId) {
    try {
      const result = await this.getUserAppointments(userId);
      return result.success && result.appointments.length > 0;
    } catch (error) {
      console.error('[SQLite] Error checking existing appointments:', error);
      return false;
    }
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   */
  getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('[SQLite] Error closing database:', err.message);
          } else {
            console.log('[SQLite] Database connection closed');
          }
          resolve();
        });
      });
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    await this.initPromise;
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          COUNT(CASE WHEN status = 'rescheduled' THEN 1 END) as rescheduled
        FROM appointments
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('[SQLite] Error getting stats:', err.message);
          reject(err);
        } else {
          resolve({
            success: true,
            stats: row
          });
        }
      });
    });
  }
}

export default new SQLiteService();
