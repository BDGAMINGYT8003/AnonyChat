const { Events, ChannelType } = require('discord.js');
const db = require('../services/database');
const safety = require('../services/safety');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages and non-DM messages
        if (message.author.bot || message.channel.type !== ChannelType.DM) return;

        try {
            // Check if user has an active session
            const session = db.getActiveSessionForUser(message.author.id);
            if (!session) {
                // No active session. If it's not a command (starts with /), maybe guide them?
                // But slash commands are handled in interactionCreate.
                // Regular messages in DM without session are ignored or could trigger a help message.
                // To avoid spam, we might just ignore or send a one-time "Use /new to start" if they are not onboarded.
                return;
            }

            // User is in a chat session. Relay message.
            const partnerId = session.user1_id === message.author.id ? session.user2_id : session.user1_id;
            const partner = await message.client.users.fetch(partnerId);

            if (!partner) {
                // Partner not found (maybe left server?), end session
                db.endChatSession(session.session_id);
                await message.author.send({ embeds: [EmbedFactory.createErrorEmbed("Error", "Chat partner unavailable. Session ended.")] });
                return;
            }

            // Update activity
            db.updateSessionActivity(session.session_id);

            // Safety check
            const { isAllowed, filteredMessage, violations } = safety.filterMessage(message.content);

            if (!isAllowed) {
                await message.author.send({ embeds: [EmbedFactory.createErrorEmbed("Message Blocked", "Your message contains prohibited content.")] });
                await safety.handleViolation(message.author.id, violations.join(", "));
                return;
            }

            // Handle media & stickers
            const hasMedia = message.attachments.size > 0;
            const mediaCount = message.attachments.size;
            const hasStickers = message.stickers.size > 0;

            // Create relay embed
            const embed = EmbedFactory.createMessageEmbed(
                filteredMessage,
                violations.length > 0 && violations.includes("inappropriate_content"),
                hasMedia,
                mediaCount
            );

            // Add sticker info to embed or send separately?
            // Stickers are better sent as is, but bots can't always send stickers unless they are in the guild.
            // In DMs, we can send the sticker URL if it's a standard sticker, or just mention it.
            // Discord.js allows sending stickers if available.
            // However, relaying stickers between DMs is tricky because the bot might not have access to the sticker.
            // Safe bet: Send sticker image URL if possible.

            const stickerUrls = [];
            message.stickers.forEach(sticker => {
                stickerUrls.push(sticker.url);
            });

            // Send to partner
            await partner.send({ embeds: [embed] });

            // Forward attachments
            if (hasMedia) {
                const files = message.attachments.map(a => a.url);
                if (files.length > 0) {
                    await partner.send({ files: files });
                }
            }

            // Forward stickers (as files/links)
            if (hasStickers && stickerUrls.length > 0) {
                await partner.send({ files: stickerUrls });
            }

            // Confirm delivery
            await message.react('✅');

        } catch (error) {
            console.error('Error in message relay:', error);
            await message.author.send({ embeds: [EmbedFactory.createErrorEmbed("Error", "Failed to send message.")] });
        }
    },
};
