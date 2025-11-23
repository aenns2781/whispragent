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
}

module.exports = DatabaseManager;
