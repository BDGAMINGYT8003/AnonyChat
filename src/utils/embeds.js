const { EmbedBuilder, Colors } = require('discord.js');

class EmbedFactory {
    static get PRIMARY_COLOR() { return 0x3498db; }
    static get SUCCESS_COLOR() { return 0x2ecc71; }
    static get WARNING_COLOR() { return 0xf39c12; }
    static get ERROR_COLOR() { return 0xe74c3c; }
    static get INFO_COLOR() { return 0x9b59b6; }
    static get NEUTRAL_COLOR() { return 0x95a5a6; }

    static createSearchEmbed(queueSize) {
        return new EmbedBuilder()
            .setTitle("🔍 Searching for Your Perfect Match")
            .setDescription("We're finding someone amazing for you to chat with!")
            .setColor(this.PRIMARY_COLOR)
            .addFields(
                { name: "📊 Queue Status", value: `**${queueSize}** users currently searching`, inline: true },
                { name: "⏱️ Estimated Time", value: "Usually under 1 minute", inline: true },
                { name: "💡 Tip", value: "Use `/update` to improve your matches", inline: false }
            )
            .setFooter({ text: "We'll notify you the moment we find someone!" })
            .setTimestamp();
    }

    static createMatchFoundEmbed(sessionId) {
        return new EmbedBuilder()
            .setTitle("🎉 Perfect Match Found!")
            .setDescription("Welcome to BlindBond! You've been connected with someone special. Start your conversation below.")
            .setColor(Colors.Green)
            .addFields(
                { name: "💬 BlindBond Experience", value: "• Send messages directly in this DM\n• Your identity stays completely anonymous\n• Share photos, voice messages, and more\n• Build genuine connections without judgment" },
                { name: "🔧 Chat Controls", value: "Use the buttons below to manage your chat experience." },
                { name: "🤝 Share Your Identity", value: "Use `/share` if you want to reveal your username (limited to 2 times per conversation, 1-minute cooldown)" }
            )
            .setFooter({ text: `BlindBond Session • ${sessionId.substring(0, 8)}...` });
    }

    static createMessageEmbed(message, hasFilteredContent = false, hasMedia = false, mediaCount = 0) {
        const embed = new EmbedBuilder()
            .setDescription(message || ' ') // Description cannot be empty
            .setColor(hasFilteredContent ? this.WARNING_COLOR : this.NEUTRAL_COLOR)
            .setAuthor({ name: "Anonymous User", iconURL: "https://cdn.discordapp.com/embed/avatars/0.png" })
            .setTimestamp();

        const footerParts = [];
        if (hasFilteredContent) footerParts.push("⚠️ Some content was filtered");
        if (hasMedia) footerParts.push(mediaCount === 1 ? "📎 Media attached" : `📎 ${mediaCount} files attached`);

        if (footerParts.length > 0) {
            embed.setFooter({ text: footerParts.join(" • ") });
        }

        return embed;
    }

    static createChatEndedEmbed(reason = "Chat ended") {
        return new EmbedBuilder()
            .setTitle("💬 Chat Ended")
            .setDescription(`Your anonymous chat has ended. ${reason}`)
            .setColor(this.WARNING_COLOR)
            .addFields({
                name: "🔄 What's next?",
                value: "• Use `/new` to find another chat partner\n• Use `/update` to modify your preferences\n• Rate your experience below"
            })
            .setFooter({ text: "Thank you for using BlindBond!" })
            .setTimestamp();
    }

    static createFeedbackEmbed() {
        return new EmbedBuilder()
            .setTitle("⭐ How was your chat?")
            .setDescription("Your feedback helps us improve the matching experience!")
            .setColor(this.INFO_COLOR)
            .addFields({
                name: "📝 Anonymous Feedback",
                value: "This rating is completely anonymous and helps us create better matches."
            })
            .setTimestamp();
    }

    static createProfileEmbed(profile, includeAnonymousId = false) {
        const embed = new EmbedBuilder()
            .setTitle("👤 Your Profile")
            .setDescription("Here are your current preferences for matching:")
            .setColor(this.PRIMARY_COLOR)
            .addFields(
                { name: "🆔 Gender", value: profile.gender, inline: true },
                { name: "🎂 Age", value: `${profile.age} years old`, inline: true },
                { name: "🌍 Location", value: profile.location, inline: true },
                { name: "💕 Interested In", value: profile.interested_in, inline: true },
                { name: "⭐ Status", value: "✅ Profile Complete", inline: true }
            );

        if (profile.interests && profile.interests.length > 0) {
            let interestsText = profile.interests.slice(0, 5).join(", ");
            if (profile.interests.length > 5) {
                interestsText += ` +${profile.interests.length - 5} more`;
            }
            embed.addFields({ name: "🎨 Interests", value: interestsText });
        }

        if (includeAnonymousId) {
            embed.addFields({ name: "🔒 Anonymous ID", value: `\`${profile.anonymous_id.substring(0, 8)}...\`` });
        }

        embed.setFooter({ text: "Use the buttons below to update your preferences" })
            .setTimestamp();

        return embed;
    }

    static createWelcomeEmbed() {
        return new EmbedBuilder()
            .setTitle("🌟 Welcome to BlindBond!")
            .setDescription("Connect with people from around the world through safe, anonymous one-on-one chats.")
            .setColor(this.SUCCESS_COLOR)
            .addFields(
                { name: "✨ What makes us special?", value: "• **Completely Anonymous** - No usernames shared\n• **Smart Matching** - Based on your preferences\n• **Safe Environment** - Advanced moderation & reporting\n• **Real Connections** - Genuine conversations" },
                { name: "🚀 Ready to start?", value: "First, let's set up your anonymous profile and go over the community guidelines." }
            )
            .setFooter({ text: "Click below to agree to our community guidelines and continue" })
            .setTimestamp();
    }

    static createRulesEmbed() {
        return new EmbedBuilder()
            .setTitle("📋 Community Guidelines")
            .setDescription("Please read and agree to follow these simple rules:")
            .setColor(this.INFO_COLOR)
            .addFields(
                { name: "🤝 Be Respectful", value: "Treat everyone with kindness and respect" },
                { name: "🔒 Protect Privacy", value: "Don't share personal information (real name, address, phone, etc.)" },
                { name: "🚫 No Inappropriate Content", value: "No sexual content, harassment, or illegal material" },
                { name: "📷 No Files/Images", value: "File sharing is disabled for everyone's safety (except in active chats)" },
                { name: "⚖️ Consequences", value: "Violations result in warnings, temporary bans, or permanent removal" }
            )
            .setFooter({ text: "By continuing, you agree to follow these guidelines" })
            .setTimestamp();
    }

    static createErrorEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setColor(this.ERROR_COLOR)
            .setTimestamp();
    }

    static createSuccessEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`✅ ${title}`)
            .setDescription(description)
            .setColor(this.SUCCESS_COLOR)
            .setTimestamp();
    }

    static createInfoEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setColor(this.INFO_COLOR)
            .setTimestamp();
    }

    static createIdleWarningEmbed() {
        return new EmbedBuilder()
            .setTitle("⏰ Idle Warning")
            .setDescription("Your chat has been inactive for 15 minutes.")
            .setColor(this.WARNING_COLOR)
            .addFields(
                { name: "🔔 Action Required", value: "Send a message within 15 minutes or the chat will end automatically." },
                { name: "💡 BlindBond Tip", value: "Keep the conversation flowing to maintain your BlindBond connection!" }
            )
            .setTimestamp();
    }
}

module.exports = EmbedFactory;
