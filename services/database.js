const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class DatabaseService {
    constructor() {
        this.db = new Database(path.join(__dirname, '../blindbond.db'));
        this.initSchema();
    }

    initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                anonymous_id TEXT UNIQUE,
                gender TEXT DEFAULT '',
                age INTEGER DEFAULT 0,
                location TEXT DEFAULT '',
                interested_in TEXT DEFAULT '',
                interests TEXT DEFAULT '[]',
                created_at TEXT,
                updated_at TEXT,
                is_onboarded INTEGER DEFAULT 0,
                warnings INTEGER DEFAULT 0,
                is_banned INTEGER DEFAULT 0,
                ban_expires_at TEXT
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                user1_id TEXT,
                user2_id TEXT,
                user1_anonymous_id TEXT,
                user2_anonymous_id TEXT,
                started_at TEXT,
                last_activity TEXT,
                is_active INTEGER DEFAULT 1,
                warning_sent INTEGER DEFAULT 0,
                message_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS block_list (
                blocker_id TEXT,
                blocked_anonymous_id TEXT,
                blocked_at TEXT,
                PRIMARY KEY (blocker_id, blocked_anonymous_id)
            );

            CREATE TABLE IF NOT EXISTS reports (
                report_id TEXT PRIMARY KEY,
                reporter_anonymous_id TEXT,
                reported_anonymous_id TEXT,
                reason TEXT,
                description TEXT,
                chat_history TEXT,
                created_at TEXT,
                is_resolved INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS connection_requests (
                request_id TEXT PRIMARY KEY,
                session_id TEXT,
                requester_user_id TEXT,
                target_user_id TEXT,
                requester_anonymous_id TEXT,
                target_anonymous_id TEXT,
                created_at TEXT,
                is_mutual INTEGER DEFAULT 0,
                is_resolved INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS username_shares (
                session_id TEXT,
                user_id TEXT,
                shared_at TEXT
            );
        `);
    }

    // User Profile Operations
    createUserProfile(userId) {
        const anonymousId = uuidv4();
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
            INSERT INTO user_profiles
            (user_id, anonymous_id, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        `);

        stmt.run(String(userId), anonymousId, now, now);
        return anonymousId;
    }

    getUserProfile(userId) {
        const stmt = this.db.prepare('SELECT * FROM user_profiles WHERE user_id = ?');
        const user = stmt.get(String(userId));
        if (user) {
            user.interests = JSON.parse(user.interests);
            user.is_onboarded = Boolean(user.is_onboarded);
            user.is_banned = Boolean(user.is_banned);
        }
        return user;
    }

    getUserByAnonymousId(anonymousId) {
        const stmt = this.db.prepare('SELECT * FROM user_profiles WHERE anonymous_id = ?');
        const user = stmt.get(anonymousId);
        if (user) {
            user.interests = JSON.parse(user.interests);
            user.is_onboarded = Boolean(user.is_onboarded);
            user.is_banned = Boolean(user.is_banned);
        }
        return user;
    }

    updateUserProfile(profile) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            UPDATE user_profiles SET
                gender = ?, age = ?, location = ?, interested_in = ?, interests = ?,
                updated_at = ?, is_onboarded = ?, warnings = ?,
                is_banned = ?, ban_expires_at = ?
            WHERE user_id = ?
        `);

        stmt.run(
            profile.gender,
            profile.age,
            profile.location,
            profile.interested_in,
            JSON.stringify(profile.interests),
            now,
            profile.is_onboarded ? 1 : 0,
            profile.warnings,
            profile.is_banned ? 1 : 0,
            profile.ban_expires_at,
            String(profile.user_id)
        );
    }

    // Chat Session Operations
    createChatSession(user1Id, user2Id, user1Anon, user2Anon) {
        const sessionId = uuidv4();
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
            INSERT INTO chat_sessions
            (session_id, user1_id, user2_id, user1_anonymous_id, user2_anonymous_id, started_at, last_activity, warning_sent, message_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
        `);

        stmt.run(sessionId, String(user1Id), String(user2Id), user1Anon, user2Anon, now, now);
        return sessionId;
    }

    getActiveSessionForUser(userId) {
        const stmt = this.db.prepare(`
            SELECT * FROM chat_sessions
            WHERE (user1_id = ? OR user2_id = ?) AND is_active = 1
        `);

        const session = stmt.get(String(userId), String(userId));
        if (session) {
            session.is_active = Boolean(session.is_active);
        }
        return session;
    }

    getChatSession(sessionId) {
        const stmt = this.db.prepare('SELECT * FROM chat_sessions WHERE session_id = ?');
        const session = stmt.get(sessionId);
        if (session) {
            session.is_active = Boolean(session.is_active);
        }
        return session;
    }

    updateSessionActivity(sessionId) {
        const now = new Date().toISOString();
        // Also reset warning_sent if activity happens
        const stmt = this.db.prepare('UPDATE chat_sessions SET last_activity = ?, warning_sent = 0 WHERE session_id = ?');
        stmt.run(now, sessionId);
    }

    incrementMessageCount(sessionId) {
        const stmt = this.db.prepare('UPDATE chat_sessions SET message_count = message_count + 1 WHERE session_id = ?');
        stmt.run(sessionId);
    }

    endChatSession(sessionId) {
        const stmt = this.db.prepare('UPDATE chat_sessions SET is_active = 0 WHERE session_id = ?');
        stmt.run(sessionId);
    }

    getActiveSessions() {
        const stmt = this.db.prepare('SELECT * FROM chat_sessions WHERE is_active = 1');
        const sessions = stmt.all();
        return sessions.map(session => ({
            ...session,
            is_active: Boolean(session.is_active),
            warning_sent: Boolean(session.warning_sent)
        }));
    }

    markSessionWarningSent(sessionId) {
        const stmt = this.db.prepare('UPDATE chat_sessions SET warning_sent = 1 WHERE session_id = ?');
        stmt.run(sessionId);
    }

    // Block List Operations
    addBlock(blockerId, blockedAnonymousId) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO block_list (blocker_id, blocked_anonymous_id, blocked_at)
            VALUES (?, ?, ?)
        `);
        stmt.run(String(blockerId), blockedAnonymousId, now);
    }

    removeBlock(blockerId, blockedAnonymousId) {
        const stmt = this.db.prepare('DELETE FROM block_list WHERE blocker_id = ? AND blocked_anonymous_id = ?');
        stmt.run(String(blockerId), blockedAnonymousId);
    }

    getBlockedUsers(userId) {
        const stmt = this.db.prepare('SELECT blocked_anonymous_id FROM block_list WHERE blocker_id = ?');
        const rows = stmt.all(String(userId));
        return rows.map(row => row.blocked_anonymous_id);
    }

    isBlocked(blockerId, blockedAnonymousId) {
        const stmt = this.db.prepare('SELECT 1 FROM block_list WHERE blocker_id = ? AND blocked_anonymous_id = ?');
        return !!stmt.get(String(blockerId), blockedAnonymousId);
    }

    // Report Operations
    createReport(reporterAnon, reportedAnon, reason, description, chatHistory) {
        const reportId = uuidv4();
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
            INSERT INTO reports
            (report_id, reporter_anonymous_id, reported_anonymous_id, reason, description, chat_history, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(reportId, reporterAnon, reportedAnon, reason, description, chatHistory, now);
        return reportId;
    }

    // Connection Request Operations
    createConnectionRequest(sessionId, requesterId, targetId, requesterAnon, targetAnon) {
        const requestId = uuidv4();
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
            INSERT INTO connection_requests
            (request_id, session_id, requester_user_id, target_user_id, requester_anonymous_id, target_anonymous_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(requestId, sessionId, String(requesterId), String(targetId), requesterAnon, targetAnon, now);
        return requestId;
    }

    checkMutualConnectionRequest(sessionId, userId) {
        const stmt = this.db.prepare(`
            SELECT requester_user_id, target_user_id FROM connection_requests
            WHERE session_id = ? AND target_user_id = ? AND is_resolved = 0
        `);

        const row = stmt.get(sessionId, String(userId));

        if (row) {
            const updateStmt = this.db.prepare(`
                UPDATE connection_requests SET is_mutual = 1, is_resolved = 1
                WHERE session_id = ? AND target_user_id = ?
            `);
            updateStmt.run(sessionId, String(userId));
            return [row.requester_user_id, row.target_user_id];
        }

        return null;
    }

    // Share Data
    getShareData(sessionId, userId) {
        const stmt = this.db.prepare(`
            SELECT shared_at FROM username_shares
            WHERE session_id = ? AND user_id = ?
            ORDER BY shared_at DESC
        `);

        const rows = stmt.all(sessionId, String(userId));

        return {
            count: rows.length,
            last_share: rows.length > 0 ? new Date(rows[0].shared_at) : null
        };
    }

    recordUsernameShare(sessionId, userId) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO username_shares (session_id, user_id, shared_at)
            VALUES (?, ?, ?)
        `);
        stmt.run(sessionId, String(userId), now);
    }
}

module.exports = new DatabaseService();
