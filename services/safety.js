const db = require('./database');
const { EmbedBuilder } = require('discord.js');

class SafetyService {
    constructor() {
        // Content filtering patterns
        this.inappropriatePatterns = [
            /\b(?:fuck|shit|damn|bitch|asshole|cunt|dick|cock|pussy|nigger|faggot|retard)\b/i,
            /\b(?:sex|porn|nude|naked|xxx|dick pic|send nudes)\b/i,
            /\b(?:kill yourself|kys|die|suicide)\b/i,
            /\b(?:rape|molest|abuse)\b/i
        ];

        // Spam patterns
        this.spamPatterns = [
            /(.)\1{10,}/,  // Character repetition
            /(?:https?:\/\/|www\.)\S+/i,  // Links
            /\b(?:discord\.gg|invite)\b/i,  // Discord invites
            /\b(?:telegram|whatsapp|snapchat|instagram|twitter|facebook)\b/i  // Social media
        ];
    }

    filterMessage(message) {
        let violations = [];
        let filteredMessage = message;

        // Check for inappropriate content
        for (const pattern of this.inappropriatePatterns) {
            if (pattern.test(message)) {
                violations.push("inappropriate_content");
                filteredMessage = filteredMessage.replace(pattern, (match) => '*'.repeat(match.length));
            }
        }

        // Check for spam patterns
        for (const pattern of this.spamPatterns) {
            if (pattern.test(message)) {
                violations.push("spam_content");
                return { isAllowed: false, filteredMessage: "", violations };
            }
        }

        // Check message length
        if (message.length > 2000) {
            violations.push("message_too_long");
            filteredMessage = message.substring(0, 1997) + "...";
        }

        // Allow message if only minor violations (inappropriate words filtered)
        // If there are inappropriate words, we still allow it because we filtered them.
        // We only block if there's spam or other severe violations.

        // Re-check logic: Python version says:
        // is_allowed = len(violations) == 0 or (len(violations) == 1 and "inappropriate_content" in violations)

        // My implementation adds "spam_content" to violations array if found, but also returns immediately?
        // Ah, in loop: return { isAllowed: false ... } for spam.
        // So violations array only contains "inappropriate_content" if we reach here.
        // Unless I had other checks.

        const isAllowed = true; // Since we filtered inappropriate content and blocked spam already.

        return { isAllowed, filteredMessage, violations };
    }

    checkUserSafetyStatus(userId) {
        const profile = db.getUserProfile(userId);
        if (!profile) {
            return { isAllowed: true, reason: null };
        }

        // Check if banned
        if (profile.is_banned) {
            const now = new Date();
            const banExpiresAt = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;

            if (banExpiresAt && now >= banExpiresAt) {
                // Ban expired, remove it
                profile.is_banned = false;
                profile.ban_expires_at = null;
                db.updateUserProfile(profile);
                return { isAllowed: true, reason: null };
            } else {
                const banReason = !banExpiresAt ? "permanently banned" : `temporarily banned until ${banExpiresAt.toLocaleString()}`;
                return { isAllowed: false, reason: `You are ${banReason} from using this bot.` };
            }
        }

        return { isAllowed: true, reason: null };
    }

    handleViolation(userId, violationType, severity = 1) {
        const profile = db.getUserProfile(userId);
        if (!profile) {
            return { continueAllowed: false, actionMessage: "User profile not found." };
        }

        profile.warnings += severity;
        let actionMessage = "";

        if (profile.warnings >= 3) {
            // Permanent ban
            profile.is_banned = true;
            profile.ban_expires_at = null;
            actionMessage = "You have been permanently banned from the bot due to repeated violations.";
        } else if (profile.warnings >= 2) {
            // Temporary ban (24 hours)
            profile.is_banned = true;
            const tomorrow = new Date();
            tomorrow.setHours(tomorrow.getHours() + 24);
            profile.ban_expires_at = tomorrow.toISOString();
            actionMessage = "You have been temporarily banned for 24 hours due to repeated violations.";
        } else {
            // Warning
            actionMessage = `⚠️ Warning: ${violationType}. Further violations may result in a ban. (${profile.warnings}/3 warnings)`;
        }

        db.updateUserProfile(profile);

        return { continueAllowed: profile.warnings < 2, actionMessage };
    }

    createReport(reporterUserId, reportedUserId, reason, description, chatHistory) {
        const reporterProfile = db.getUserProfile(reporterUserId);
        const reportedProfile = db.getUserProfile(reportedUserId);

        if (!reporterProfile || !reportedProfile) {
            throw new Error("Invalid user profiles for report");
        }

        // Sanitize chat history - only keep last 10 messages for context
        const sanitizedHistory = chatHistory ? chatHistory.slice(-10).join("\n") : "No chat history available";

        return db.createReport(
            reporterProfile.anonymous_id,
            reportedProfile.anonymous_id,
            reason,
            description,
            sanitizedHistory
        );
    }

    autoModeratePatternDetection(userId, message) {
        // Check for repeated similar messages (spam detection)
        if (message.length < 5) {
            return Promise.resolve(false);
        }

        // Check for excessive caps
        const upperCaseCount = message.replace(/[^A-Z]/g, "").length;
        if (message.length > 20 && upperCaseCount / message.length > 0.7) {
            return Promise.resolve(this.handleViolation(userId, "excessive_caps").then(() => true));
        }

        // Check for rapid repetition patterns
        const words = message.toLowerCase().split(/\s+/);
        if (words.length > 5) {
            const wordCounts = {};
            for (const word of words) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }

            // If more than 50% of words are the same
            const maxCount = Math.max(...Object.values(wordCounts));
            if (maxCount / words.length > 0.5) {
                return Promise.resolve(this.handleViolation(userId, "spam_repetition").then(() => true));
            }
        }

        return Promise.resolve(false);
    }

    emergencyBlockUser(blockerId, blockedUserId, reason = "emergency_block") {
        const blockedProfile = db.getUserProfile(blockedUserId);
        if (!blockedProfile) {
            return "Unable to block - user not found";
        }

        // Add to block list
        db.addBlock(blockerId, blockedProfile.anonymous_id);

        // Create high-priority report
        const reportId = this.createReport(
            blockerId,
            blockedUserId,
            "Emergency Block",
            `User triggered emergency block: ${reason}`,
            []
        );

        return `User has been blocked and reported. Report ID: ${reportId}`;
    }
}

module.exports = new SafetyService();
