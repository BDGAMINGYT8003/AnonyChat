const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('./database');
const safety = require('./safety');
const EmbedFactory = require('../utils/embeds');

class ChatService {
    constructor() {
        // We will need client access for fetching users, but it's often passed or global.
        // For now, methods accept 'client' or interaction/message.
    }

    async startChatSession(client, user1Id, user2Id, user1Anon, user2Anon) {
        const sessionId = db.createChatSession(user1Id, user2Id, user1Anon, user2Anon);

        const embed = EmbedFactory.createMatchFoundEmbed(sessionId);
        const row = this.createChatControlView();

        try {
            const user1 = await client.users.fetch(user1Id);
            const user2 = await client.users.fetch(user2Id);

            await user1.send({ embeds: [embed], components: [row] });
            await user2.send({ embeds: [embed], components: [row] });

            return sessionId;
        } catch (error) {
            console.error(`Cannot send DM to users in session ${sessionId}:`, error);
            db.endChatSession(sessionId);
            return null;
        }
    }

    createChatControlView() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('chat_end')
                    .setLabel('End Chat')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🛑'),
                new ButtonBuilder()
                    .setCustomId('chat_report')
                    .setLabel('Report')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚩'),
                new ButtonBuilder()
                    .setCustomId('chat_emergency')
                    .setLabel('Emergency Block')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚠️')
            );
    }

    async handleMessage(message) {
        if (message.author.bot) return;

        const session = db.getActiveSessionForUser(message.author.id);
        if (!session) return;

        // Block slash commands
        if (message.content.trim().startsWith('/')) {
            await message.react("❌").catch(() => {});
            await message.author.send("❌ Commands starting with `/` cannot be sent in chat. These are reserved for bot commands.");
            return;
        }

        // Safety check
        const safetyStatus = safety.checkUserSafetyStatus(message.author.id);
        if (!safetyStatus.isAllowed) {
            await message.author.send(`❌ ${safetyStatus.reason}`);
            return;
        }

        const { isAllowed, filteredMessage, violations } = safety.filterMessage(message.content);
        if (!isAllowed) { // This handles SPAM blocking (returns false), profanity is filtered (returns true)
             await message.author.send("❌ Your message was blocked due to inappropriate content.");
             const { continueAllowed, actionMessage } = safety.handleViolation(message.author.id, `blocked_message: ${violations.join(", ")}`);
             if (actionMessage) await message.author.send(actionMessage);
             if (!continueAllowed) await this.endChat(message.client, session.session_id, "User violation");
             return;
        }

        // Prepare Forwarding
        const hasMedia = message.attachments.size > 0;
        const mediaCount = message.attachments.size;
        const hasStickers = message.stickers.size > 0;
        const hasFilteredContent = violations.length > 0 && violations.includes("inappropriate_content");

        // DB Update
        db.updateSessionActivity(session.session_id);
        db.incrementMessageCount(session.session_id);

        // Target
        const partnerId = session.user1_id === message.author.id ? session.user2_id : session.user1_id;

        try {
            const partner = await message.client.users.fetch(partnerId);

            // 1. Embed Logic
            const embed = EmbedFactory.createMessageEmbed(
                filteredMessage,
                hasFilteredContent,
                hasMedia || hasStickers, // "Media attached" footer
                mediaCount + (hasStickers ? message.stickers.size : 0)
            );

            // 2. Sticker Info in Embed Description (as per Python code)
            const stickerUrls = [];
            if (hasStickers) {
                const sticker = message.stickers.first();
                const stickerInfo = `\n\n🎭 **Sticker:** ${sticker.name} - [View Sticker](${sticker.url})`;
                embed.setDescription((embed.data.description || "") + stickerInfo);
                stickerUrls.push(sticker.url);
            }

            // 3. Attachments
            const files = message.attachments.map(a => ({ attachment: a.url }));

            // 4. Send Main Message
            await partner.send({ embeds: [embed], files: files }); // Stickers as files? No, just link in embed + maybe file if supported. Python code just put link in embed. Node code puts link in embed.
            // Wait, Python code said: "if stickers... send_kwargs['embed'] = embed" (modified description).

            // 5. Rich Embeds (Links)
            if (message.embeds.length > 0 && !hasMedia) {
                // Forward original embeds (limit 3)
                for (const originalEmbed of message.embeds.slice(0, 3)) {
                     // We can't just forward the raw embed object sometimes due to structure differences,
                     // but discord.js usually handles it if it's a valid EmbedBuilder/JSON.
                     // However, message.embeds are APIEmbeds.
                     // Let's try sending them.
                     await partner.send({ embeds: [originalEmbed] }).catch(() => {});
                }
            }

            await message.react('✅').catch(() => {});
        } catch (error) {
             console.error("Message relay failed:", error);
             await message.author.send("❌ Could not deliver your message. The other user may have left.");
             this.endChat(message.client, session.session_id, "Message delivery failed");
        }
    }

    async endChat(client, sessionId, reason = "Session ended") {
        const session = db.getChatSession(sessionId);
        if (!session || !session.is_active) return false; // Already ended

        db.endChatSession(sessionId);

        // Stats
        const durationSeconds = (new Date() - new Date(session.started_at)) / 1000;
        const durationStr = this.formatDuration(durationSeconds);
        const messageCount = session.message_count || 0;

        const summaryText = `Duration: ${durationStr}\nTotal messages exchanged: ${messageCount}`;
        const embed = EmbedFactory.createChatEndedEmbed(reason);
        embed.addFields({ name: "📊 Conversation Summary", value: summaryText });

        const user1Id = session.user1_id;
        const user2Id = session.user2_id;

        const sendEndMessage = async (userId, otherUserId, otherUserAnon) => {
            try {
                const user = await client.users.fetch(userId);
                const row = this.createFeedbackView(sessionId, otherUserId, otherUserAnon);
                await user.send({ embeds: [embed], components: [row] });
            } catch (e) {
                // User blocked bot or left
            }
        };

        await sendEndMessage(user1Id, user2Id, session.user2_anonymous_id);
        await sendEndMessage(user2Id, user1Id, session.user1_anonymous_id);

        return true;
    }

    createFeedbackView(sessionId, otherUserId, otherUserAnon) {
         return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId(`feedback_good:${sessionId}:${otherUserId}`).setLabel('Good').setStyle(ButtonStyle.Success).setEmoji('👍'),
                new ButtonBuilder().setCustomId(`feedback_okay:${sessionId}`).setLabel('Okay').setStyle(ButtonStyle.Secondary).setEmoji('👌'),
                new ButtonBuilder().setCustomId(`feedback_bad:${sessionId}`).setLabel('Bad').setStyle(ButtonStyle.Danger).setEmoji('👎'),
                new ButtonBuilder().setCustomId(`chat_report_end:${otherUserId}`).setLabel('Report').setStyle(ButtonStyle.Secondary).setEmoji('🚩'), // Pass ID
                new ButtonBuilder().setCustomId(`chat_block:${otherUserId}:${otherUserAnon}`).setLabel('Block User').setStyle(ButtonStyle.Secondary).setEmoji('🚫')
            );
    }

    formatDuration(seconds) {
        if (seconds < 60) return `${Math.floor(seconds)} seconds`;
        if (seconds < 3600) return `${Math.floor(seconds/60)} minutes`;
        return `${Math.floor(seconds/3600)} hours ${Math.floor((seconds%3600)/60)} minutes`;
    }

    async blockUser(client, blockerId, blockedUserId, blockedAnonId, emergency = false) {
        // Add to block list
        db.addBlock(blockerId, blockedAnonId);

        if (emergency) {
            safety.emergencyBlockUser(blockerId, blockedUserId, "emergency_button");
        }

        // End session if active
        const session = db.getActiveSessionForUser(blockerId);
        if (session) {
            // Verify if this session involves the blocked user
            if (session.user1_id === blockedUserId || session.user2_id === blockedUserId) {
                await this.endChat(client, session.session_id, emergency ? "Emergency block activated" : "User blocked");
                return "User has been blocked and chat ended.";
            }
        }
        return "User has been blocked.";
    }
}

module.exports = new ChatService();
