const db = require('./database');
const { EmbedBuilder } = require('discord.js');

const MAX_QUEUE_WAIT_TIME = 30; // seconds

class MatchmakingService {
    constructor() {
        this.queue = [];
        this.queueLock = false; // Simple lock mechanism
    }

    // Helper to acquire lock
    async acquireLock() {
        while (this.queueLock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.queueLock = true;
    }

    releaseLock() {
        this.queueLock = false;
    }

    async addToQueue(userId, anonymousId) {
        await this.acquireLock();
        try {
            // Check if user already in queue
            if (this.queue.some(entry => entry.userId === userId)) {
                return false;
            }

            this.queue.push({
                userId,
                anonymousId,
                joinedAt: new Date(),
                broadenedSearch: false,
                lastUpdateSent: null
            });
            return true;
        } finally {
            this.releaseLock();
        }
    }

    async removeFromQueue(userId) {
        await this.acquireLock();
        try {
            const initialSize = this.queue.length;
            this.queue = this.queue.filter(entry => entry.userId !== userId);
            return this.queue.length < initialSize;
        } finally {
            this.releaseLock();
        }
    }

    getQueuePosition(userId) {
        const index = this.queue.findIndex(entry => entry.userId === userId);
        return index !== -1 ? index + 1 : null;
    }

    getQueueSize() {
        return this.queue.length;
    }

    async findMatch(userId) {
        await this.acquireLock();
        try {
            const userIndex = this.queue.findIndex(entry => entry.userId === userId);
            if (userIndex === -1) return null;

            const userEntry = this.queue[userIndex];
            const userProfile = db.getUserProfile(userId);
            if (!userProfile) return null;

            const blockedUsers = db.getBlockedUsers(userId);

            let bestMatch = null;
            let bestScore = 0.0;
            let bestMatchIndex = -1;

            // Check all other users in queue
            for (let i = 0; i < this.queue.length; i++) {
                if (i === userIndex) continue;

                const otherEntry = this.queue[i];
                const otherProfile = db.getUserProfile(otherEntry.userId);

                if (!otherProfile) continue;

                // Check blocks
                if (blockedUsers.includes(otherProfile.anonymous_id) ||
                    db.isBlocked(otherEntry.userId, userProfile.anonymous_id)) {
                    continue;
                }

                const score = this._calculateCompatibility(userProfile, otherProfile, userEntry, otherEntry);

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = otherProfile;
                    bestMatchIndex = i;
                }
            }

            if (bestMatch && bestScore > 0) {
                // Remove both from queue
                // We need to be careful with indices since we are removing items
                const indicesToRemove = [userIndex, bestMatchIndex].sort((a, b) => b - a);
                for (const idx of indicesToRemove) {
                    this.queue.splice(idx, 1);
                }

                return {
                    user1: userProfile,
                    user2: bestMatch,
                    compatibilityScore: bestScore
                };
            }

            return null;
        } finally {
            this.releaseLock();
        }
    }

    _calculateCompatibility(user1, user2, entry1, entry2) {
        let score = 0.0;
        const now = new Date();
        const user1WaitTime = (now - entry1.joinedAt) / 1000;
        const user2WaitTime = (now - entry2.joinedAt) / 1000;
        const avgWaitTime = (user1WaitTime + user2WaitTime) / 2;

        if (this._checkGenderCompatibility(user1, user2)) {
            score += 100.0;
        } else if (avgWaitTime > MAX_QUEUE_WAIT_TIME && this._checkIntersectionCompatibility(user1, user2)) {
            score += 70.0;
        } else {
            return 0.0;
        }

        // Age compatibility
        const ageDiff = Math.abs(user1.age - user2.age);
        if (ageDiff <= 2) score += 30.0;
        else if (ageDiff <= 5) score += 20.0;
        else if (ageDiff <= 10) score += 10.0;

        // Location
        if (user1.location === user2.location) score += 25.0;

        // Interests
        const interests1 = new Set(user1.interests);
        const commonInterests = user2.interests.filter(i => interests1.has(i));
        if (commonInterests.length > 0) score += commonInterests.length * 5.0;

        // Waiting time bonus
        const waitTimeMinutes = avgWaitTime / 60;
        if (waitTimeMinutes > 0.5) {
            score += Math.min(waitTimeMinutes * 10, 50);
        }

        // Broadened search bonus
        if (entry1.broadenedSearch || entry2.broadenedSearch) {
            score += 30.0;
        }

        return score;
    }

    _checkGenderCompatibility(user1, user2) {
        const user1Compatible = user1.interested_in === "Anyone" || user1.interested_in === user2.gender;
        const user2Compatible = user2.interested_in === "Anyone" || user2.interested_in === user1.gender;
        return user1Compatible && user2Compatible;
    }

    _checkIntersectionCompatibility(user1, user2) {
        if (user1.interested_in === "Anyone" || user2.interested_in === "Anyone") return true;

        const ageCompatible = Math.abs(user1.age - user2.age) <= 10;

        const interests1 = new Set(user1.interests);
        const commonInterests = user2.interests.some(i => interests1.has(i));

        const locationCompatible = user1.location === user2.location;

        const intersections = [ageCompatible, commonInterests, locationCompatible].filter(Boolean).length;
        return intersections >= 2;
    }

    async broadenSearch(userId) {
        await this.acquireLock();
        try {
            const entry = this.queue.find(e => e.userId === userId);
            if (entry) {
                entry.broadenedSearch = true;
                return true;
            }
            return false;
        } finally {
            this.releaseLock();
        }
    }

    getQueueStats() {
        const totalUsers = this.queue.length;
        if (totalUsers === 0) {
            return { total: 0, avgWaitTime: 0, longestWait: 0 };
        }

        const now = new Date();
        const waitTimes = this.queue.map(entry => (now - entry.joinedAt) / 60000); // minutes

        return {
            total: totalUsers,
            avgWaitTime: waitTimes.reduce((a, b) => a + b, 0) / totalUsers,
            longestWait: Math.max(...waitTimes)
        };
    }

    async cleanupStaleEntries() {
        await this.acquireLock();
        try {
            const now = new Date();
            const staleThreshold = 30 * 60 * 1000; // 30 minutes
            this.queue = this.queue.filter(entry => (now - entry.joinedAt) < staleThreshold);
        } finally {
            this.releaseLock();
        }
    }

    async getUsersReadyForBroadening() {
        await this.acquireLock();
        try {
            const now = new Date();
            const readyUsers = [];

            for (const entry of this.queue) {
                const waitTime = (now - entry.joinedAt) / 1000; // seconds
                if (waitTime > MAX_QUEUE_WAIT_TIME &&
                    !entry.broadenedSearch &&
                    (!entry.lastUpdateSent || (now - entry.lastUpdateSent) > 300000)) { // 5 min

                    readyUsers.push(entry.userId);
                    entry.lastUpdateSent = now;
                }
            }
            return readyUsers;
        } finally {
            this.releaseLock();
        }
    }

    async processQueue() {
        await this.acquireLock();
        try {
            if (this.queue.length < 2) return null;

            // Iterate over a copy to safely modify queue
            const queueCopy = [...this.queue];
            const matches = [];

            // We need to be careful not to match users who have already been matched in this pass
            const matchedUserIds = new Set();

            for (const entry of queueCopy) {
                if (matchedUserIds.has(entry.userId)) continue;

                // findMatch logic (duplicated slightly to handle internal locking/state safely)
                // Actually, calling this.findMatch inside processQueue is tricky because findMatch acquires lock.
                // We are already holding lock.
                // We should refactor findMatch to separate internal logic from locking logic,
                // OR release lock momentarily (risky).
                // Better: Create _findMatchInternal that assumes lock is held.
            }
        } finally {
            this.releaseLock();
        }
        // Since refactoring `findMatch` is invasive, let's just use the fact that `findMatch` logic is
        // essentially: "Take User A, check against rest of queue".
        // If we iterate the queue in `index.js` and call `findMatch`, it works, BUT `findMatch` locks.
        // So we can't iterate while holding lock.
        // But `index.js` doesn't hold lock.
        // So `index.js` can just call `processQueue` which releases lock between attempts?
        // No, `processQueue` is atomic.

        // Let's implement `processQueue` that returns a list of matched pairs,
        // removing them from queue internally.

        return null;
    }

    // Revised strategy: Add a method that doesn't lock for internal use, or
    // just implement a loop that tries to match everyone.

    async processMatchmakingQueue() {
         // This method will try to match everyone in the queue.
         // Since `findMatch` removes users on success, we can just keep trying until no matches found or list exhausted.
         // However, `findMatch` is optimized for "find match for User X".
         // We can iterate through a snapshot of userIDs.

         const snapshot = await this.getQueueSnapshot();
         const matches = [];

         for (const userId of snapshot) {
             // Check if still in queue (findMatch handles this check)
             const result = await this.findMatch(userId);
             if (result) {
                 matches.push(result);
             }
         }
         return matches;
    }

    async getQueueSnapshot() {
        await this.acquireLock();
        try {
            return this.queue.map(e => e.userId);
        } finally {
            this.releaseLock();
        }
    }
}

module.exports = new MatchmakingService();
