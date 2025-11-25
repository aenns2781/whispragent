const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { app } = require("electron");

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  initDatabase() {
    try {
      const dbFileName =
        process.env.NODE_ENV === "development"
          ? "transcriptions-dev.db"
          : "transcriptions.db";

      const dbPath = path.join(app.getPath("userData"), dbFileName);

      this.db = new Database(dbPath);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transcriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS generated_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prompt TEXT NOT NULL,
          image_path TEXT NOT NULL,
          model TEXT,
          aspect_ratio TEXT,
          resolution TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Phrase frequency tracking for auto-suggestions
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS phrase_frequency (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phrase TEXT NOT NULL UNIQUE,
          count INTEGER DEFAULT 1,
          pattern_type TEXT,
          first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          suggested BOOLEAN DEFAULT 0,
          dismissed BOOLEAN DEFAULT 0
        )
      `);

      return true;
    } catch (error) {
      console.error("Database initialization failed:", error.message);
      throw error;
    }
  }

  saveTranscription(text) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "INSERT INTO transcriptions (text) VALUES (?)"
      );
      const result = stmt.run(text);

      const fetchStmt = this.db.prepare(
        "SELECT * FROM transcriptions WHERE id = ?"
      );
      const transcription = fetchStmt.get(result.lastInsertRowid);

      return { id: result.lastInsertRowid, success: true, transcription };
    } catch (error) {
      console.error("Error saving transcription:", error.message);
      throw error;
    }
  }

  getTranscriptions(limit = 50) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "SELECT * FROM transcriptions ORDER BY timestamp DESC LIMIT ?"
      );
      const transcriptions = stmt.all(limit);
      return transcriptions;
    } catch (error) {
      console.error("Error getting transcriptions:", error.message);
      throw error;
    }
  }

  clearTranscriptions() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM transcriptions");
      const result = stmt.run();
      return { cleared: result.changes, success: true };
    } catch (error) {
      console.error("Error clearing transcriptions:", error.message);
      throw error;
    }
  }

  deleteTranscription(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM transcriptions WHERE id = ?");
      const result = stmt.run(id);
      console.log(
        `🗑️ Deleted transcription ${id}, affected rows: ${result.changes}`
      );
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("❌ Error deleting transcription:", error);
      throw error;
    }
  }

  clearAllTranscriptions() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM transcriptions");
      const result = stmt.run();
      console.log(`🗑️ Cleared all transcriptions, deleted ${result.changes} rows`);
      return { success: true, deletedCount: result.changes };
    } catch (error) {
      console.error("❌ Error clearing transcriptions:", error);
      throw error;
    }
  }

  getTranscriptionCount() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("SELECT COUNT(*) as count FROM transcriptions");
      const result = stmt.get();
      return result.count;
    } catch (error) {
      console.error("Error getting transcription count:", error.message);
      throw error;
    }
  }

  getAllTranscriptions() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "SELECT * FROM transcriptions ORDER BY timestamp DESC"
      );
      const transcriptions = stmt.all();
      return transcriptions;
    } catch (error) {
      console.error("Error getting all transcriptions:", error.message);
      throw error;
    }
  }

  getRecentTranscriptions(days = 7) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      // Get transcriptions from the last N days
      const stmt = this.db.prepare(
        "SELECT * FROM transcriptions WHERE timestamp >= datetime('now', '-' || ? || ' days') ORDER BY timestamp DESC"
      );
      const transcriptions = stmt.all(days);
      return transcriptions;
    } catch (error) {
      console.error("Error getting recent transcriptions:", error.message);
      throw error;
    }
  }

  // Generated images methods
  saveGeneratedImage(prompt, imagePath, model, aspectRatio, resolution) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "INSERT INTO generated_images (prompt, image_path, model, aspect_ratio, resolution) VALUES (?, ?, ?, ?, ?)"
      );
      const result = stmt.run(prompt, imagePath, model, aspectRatio, resolution);

      const fetchStmt = this.db.prepare(
        "SELECT * FROM generated_images WHERE id = ?"
      );
      const generatedImage = fetchStmt.get(result.lastInsertRowid);

      return { id: result.lastInsertRowid, success: true, generatedImage };
    } catch (error) {
      console.error("Error saving generated image:", error.message);
      throw error;
    }
  }

  getGeneratedImages(limit = 50) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "SELECT * FROM generated_images ORDER BY timestamp DESC LIMIT ?"
      );
      const images = stmt.all(limit);
      return images;
    } catch (error) {
      console.error("Error getting generated images:", error.message);
      throw error;
    }
  }

  getAllGeneratedImages() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "SELECT * FROM generated_images ORDER BY timestamp DESC"
      );
      const images = stmt.all();
      return images;
    } catch (error) {
      console.error("Error getting all generated images:", error.message);
      throw error;
    }
  }

  deleteGeneratedImage(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM generated_images WHERE id = ?");
      const result = stmt.run(id);
      console.log(
        `🗑️ Deleted generated image ${id}, affected rows: ${result.changes}`
      );
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("❌ Error deleting generated image:", error);
      throw error;
    }
  }

  cleanup() {
    console.log("Starting database cleanup...");
    try {
      const dbPath = path.join(
        app.getPath("userData"),
        process.env.NODE_ENV === "development"
          ? "transcriptions-dev.db"
          : "transcriptions.db"
      );
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log("✅ Database file deleted:", dbPath);
      }
    } catch (error) {
      console.error("❌ Error deleting database file:", error);
    }
  }

  // Phrase frequency tracking methods
  trackPhrase(phrase, patternType = null) {
    try {
      if (!this.db) throw new Error("Database not initialized");

      // Insert or update phrase frequency
      const stmt = this.db.prepare(`
        INSERT INTO phrase_frequency (phrase, pattern_type, last_seen, count)
        VALUES (?, ?, datetime('now'), 1)
        ON CONFLICT(phrase) DO UPDATE SET
          count = count + 1,
          last_seen = datetime('now'),
          pattern_type = COALESCE(excluded.pattern_type, pattern_type)
      `);

      stmt.run(phrase, patternType);
      return true;
    } catch (error) {
      console.error("Error tracking phrase:", error);
      return false;
    }
  }

  getSuggestedPhrases(minCount = 3) {
    try {
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare(`
        SELECT phrase, count, pattern_type, first_seen, last_seen
        FROM phrase_frequency
        WHERE count >= ? AND dismissed = 0 AND suggested = 0
        ORDER BY count DESC, last_seen DESC
        LIMIT 10
      `);

      return stmt.all(minCount);
    } catch (error) {
      console.error("Error getting suggested phrases:", error);
      return [];
    }
  }

  markPhraseSuggested(phrase) {
    try {
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare(`
        UPDATE phrase_frequency
        SET suggested = 1
        WHERE phrase = ?
      `);

      stmt.run(phrase);
      return true;
    } catch (error) {
      console.error("Error marking phrase as suggested:", error);
      return false;
    }
  }

  dismissPhraseSuggestion(phrase) {
    try {
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare(`
        UPDATE phrase_frequency
        SET dismissed = 1, suggested = 1
        WHERE phrase = ?
      `);

      stmt.run(phrase);
      return true;
    } catch (error) {
      console.error("Error dismissing phrase suggestion:", error);
      return false;
    }
  }

  clearAllPhraseSuggestions() {
    try {
      if (!this.db) throw new Error("Database not initialized");

      const stmt = this.db.prepare(`DELETE FROM phrase_frequency`);
      const result = stmt.run();
      console.log(`[Database] Cleared ${result.changes} phrase suggestions`);
      return { success: true, cleared: result.changes };
    } catch (error) {
      console.error("Error clearing phrase suggestions:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DatabaseManager;
