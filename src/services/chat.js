const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder, FileBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./database');
const safety = require('./safety');
const EmbedFactory = require('../utils/embeds');

class ChatService {
    constructor() {
    }

    async startChatSession(client, user1Id, user2Id, user1Anon, user2Anon) {
        const sessionId = db.createChatSession(user1Id, user2Id, user1Anon, user2Anon);

        const container = EmbedFactory.createMatchFoundEmbed(sessionId);
        const row = this.createChatControlView();

        // V2: Nest controls inside the container
        container.addActionRowComponents(row);

        try {
            const user1 = await client.users.fetch(user1Id);
            const user2 = await client.users.fetch(user2Id);

            await user1.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
            await user2.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

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

        if (message.content.trim().startsWith('/')) {
            await message.react("❌").catch(() => {});
            await message.author.send({
                components: [EmbedFactory.createErrorEmbed("Command Error", "Commands starting with `/` cannot be sent in chat. These are reserved for bot commands.")],
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        const safetyStatus = safety.checkUserSafetyStatus(message.author.id);
        if (!safetyStatus.isAllowed) {
            await message.author.send({
                components: [EmbedFactory.createErrorEmbed("Safety Restriction", safetyStatus.reason)],
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        const { isAllowed, filteredMessage, violations } = safety.filterMessage(message.content);
        if (!isAllowed) {
             await message.author.send({
                 components: [EmbedFactory.createErrorEmbed("Message Blocked", "Your message was blocked due to inappropriate content.")],
                 flags: MessageFlags.IsComponentsV2
             });

             const { continueAllowed, actionMessage } = safety.handleViolation(message.author.id, `blocked_message: ${violations.join(", ")}`);
             if (actionMessage) {
                 await message.author.send({
                     components: [EmbedFactory.createErrorEmbed("Safety Action", actionMessage)],
                     flags: MessageFlags.IsComponentsV2
                 });
             }
             if (!continueAllowed) await this.endChat(message.client, session.session_id, "User violation");
             return;
        }

        const hasMedia = message.attachments.size > 0;
        const mediaCount = message.attachments.size;
        const hasStickers = message.stickers.size > 0;
        const hasFilteredContent = violations.length > 0 && violations.includes("inappropriate_content");

        db.updateSessionActivity(session.session_id);
        db.incrementMessageCount(session.session_id);

        const partnerId = session.user1_id === message.author.id ? session.user2_id : session.user1_id;

        try {
            const partner = await message.client.users.fetch(partnerId);

            // 1. Create Main Container
            const container = EmbedFactory.createMessageEmbed(
                filteredMessage,
                hasFilteredContent,
                hasMedia || hasStickers,
                mediaCount + (hasStickers ? message.stickers.size : 0)
            );

            const components = [container];
            const filesToSend = []; // For attachment:// links

            // 2. Media Gallery (Images)
            const imageAttachments = message.attachments.filter(a => a.contentType && a.contentType.startsWith('image/'));

            if (imageAttachments.size > 0) {
                const gallery = new MediaGalleryBuilder();
                imageAttachments.forEach(att => {
                    // Docs: .addItems(mediaGalleryItem => ...)
                    gallery.addItems(
                        mediaGalleryItem => mediaGalleryItem
                            .setDescription(att.description || 'Attached Image')
                            .setURL(att.url) // Using external URL directly
                    );
                });
                components.push(gallery);
            }

            // 3. Other Files (FileBuilder)
            const otherAttachments = message.attachments.filter(a => !a.contentType || !a.contentType.startsWith('image/'));
            if (otherAttachments.size > 0) {
                otherAttachments.forEach(att => {
                     // FileBuilder: .setURL('attachment://filename')
                     // We need to pass the file object in `files` array.
                     const fileBuilder = new FileBuilder().setURL(att.url); // Can we use external URL? Docs say "upload and display".
                     // Docs example: setURL('attachment://guide.pdf') and files: [file].
                     // If we pass external URL to FileBuilder, does it work?
                     // Usually FileBuilder is for uploaded files.
                     // If we just want to link it, we should put it in text.
                     // But let's try to simulate upload if we can, or just link.
                     // Since we are relaying, we can pass the attachment URL which Discord treats as external?
                     // Let's rely on text link for non-images if strict V2 fails, but try FileBuilder.
                     // Actually, we can just pass the attachment object in `files` and reference it.

                     // Since we can't easily re-upload the stream without fetching, and we want speed...
                     // We will use the URL in the TextDisplay if FileBuilder requires local upload.
                     // But wait, we can pass `files: [att.url]`.
                     // Let's try to add a FileBuilder pointing to the url.
                     components.push(new FileBuilder().setURL(att.url));
                });
            }

            // 4. Stickers
            if (hasStickers) {
                 const sticker = message.stickers.first();
                 if (sticker.url) {
                      let gallery = components.find(c => c instanceof MediaGalleryBuilder);
                      if (!gallery) {
                          gallery = new MediaGalleryBuilder();
                          components.push(gallery);
                      }
                      gallery.addItems(
                          mediaGalleryItem => mediaGalleryItem
                            .setDescription(`Sticker: ${sticker.name}`)
                            .setURL(sticker.url)
                      );
                 }
            }

            await partner.send({
                components: components,
                // files: filesToSend, // If we needed to upload local files
                flags: MessageFlags.IsComponentsV2,
            });

            await message.react('✅').catch(() => {});
        } catch (error) {
             console.error("Message relay failed:", error);
             await message.author.send({
                 components: [EmbedFactory.createErrorEmbed("Delivery Failed", "Could not deliver your message. The other user may have left.")],
                 flags: MessageFlags.IsComponentsV2
             });
             this.endChat(message.client, session.session_id, "Message delivery failed");
        }
    }

    async endChat(client, sessionId, reason = "Session ended") {
        const session = db.getChatSession(sessionId);
        if (!session || !session.is_active) return false;

        db.endChatSession(sessionId);

        const durationSeconds = (new Date() - new Date(session.started_at)) / 1000;
        const durationStr = this.formatDuration(durationSeconds);
        const messageCount = session.message_count || 0;

        const summaryText = `Duration: ${durationStr}\nTotal messages exchanged: ${messageCount}`;
        const container = EmbedFactory.createChatEndedEmbed(reason);

        // Add summary
        const { TextDisplayBuilder } = require('discord.js');
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 📊 Conversation Summary\n${summaryText}`)
        );

        const user1Id = session.user1_id;
        const user2Id = session.user2_id;

        const sendEndMessage = async (userId, otherUserId, otherUserAnon) => {
            try {
                const user = await client.users.fetch(userId);
                const row = this.createFeedbackView(sessionId, otherUserId, otherUserAnon);
                // Nest feedback controls
                container.addActionRowComponents(row);

                await user.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
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
                new ButtonBuilder().setCustomId(`chat_report_end:${otherUserId}`).setLabel('Report').setStyle(ButtonStyle.Secondary).setEmoji('🚩'),
                new ButtonBuilder().setCustomId(`chat_block:${otherUserId}:${otherUserAnon}`).setLabel('Block User').setStyle(ButtonStyle.Secondary).setEmoji('🚫')
            );
    }

    formatDuration(seconds) {
        if (seconds < 60) return `${Math.floor(seconds)} seconds`;
        if (seconds < 3600) return `${Math.floor(seconds/60)} minutes`;
        return `${Math.floor(seconds/3600)} hours ${Math.floor((seconds%3600)/60)} minutes`;
    }

    async blockUser(client, blockerId, blockedUserId, blockedAnonId, emergency = false) {
        db.addBlock(blockerId, blockedAnonId);

        if (emergency) {
            safety.emergencyBlockUser(blockerId, blockedUserId, "emergency_button");
        }

        const session = db.getActiveSessionForUser(blockerId);
        if (session) {
            if (session.user1_id === blockedUserId || session.user2_id === blockedUserId) {
                await this.endChat(client, session.session_id, emergency ? "Emergency block activated" : "User blocked");
                return "User has been blocked and chat ended.";
            }
        }
        return "User has been blocked.";
    }
}

module.exports = new ChatService();
