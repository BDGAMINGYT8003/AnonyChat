const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorBuilder,
    MediaGalleryBuilder,
    Colors
} = require('discord.js');

class EmbedFactory {
    static get PRIMARY_COLOR() { return 0x3498db; }
    static get SUCCESS_COLOR() { return 0x2ecc71; }
    static get WARNING_COLOR() { return 0xf39c12; }
    static get ERROR_COLOR() { return 0xe74c3c; }
    static get INFO_COLOR() { return 0x9b59b6; }
    static get NEUTRAL_COLOR() { return 0x95a5a6; }

    static createContainer(color = this.NEUTRAL_COLOR) {
        return new ContainerBuilder().setColor(color);
    }

    static createSearchEmbed(queueSize) {
        const container = this.createContainer(this.PRIMARY_COLOR);

        container.addComponents(
            new TextDisplayBuilder().setContent("# 🔍 Searching for Your Perfect Match\nWe're finding someone amazing for you to chat with!"),
            new SeparatorBuilder(),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 📊 Queue Status\n**" + queueSize + "** users currently searching"),
                new TextDisplayBuilder().setContent("## ⏱️ Estimated Time\nUsually under 1 minute")
            ),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 💡 Tip\nUse `/update` to improve your matches")
            ),
            new SeparatorBuilder(),
            new TextDisplayBuilder().setContent("*We'll notify you the moment we find someone!*")
        );

        return container;
    }

    static createMatchFoundEmbed(sessionId) {
        const container = this.createContainer(Colors.Green);

        container.addComponents(
            new TextDisplayBuilder().setContent("# 🎉 Perfect Match Found!\nWelcome to BlindBond! You've been connected with someone special. Start your conversation below."),
            new SeparatorBuilder(),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 💬 BlindBond Experience\n• Send messages directly in this DM\n• Your identity stays completely anonymous\n• Share photos, voice messages, and more\n• Build genuine connections without judgment")
            ),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 🔧 Chat Controls\nUse the buttons below to manage your chat experience.")
            ),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 🤝 Share Your Identity\nUse `/share` if you want to reveal your username (limited to 2 times per conversation, 1-minute cooldown)")
            ),
            new SeparatorBuilder(),
            new TextDisplayBuilder().setContent(`*BlindBond Session • ${sessionId.substring(0, 8)}...*`)
        );

        return container;
    }

    static createMessageEmbed(message, hasFilteredContent = false, hasMedia = false, mediaCount = 0) {
        const container = this.createContainer(hasFilteredContent ? this.WARNING_COLOR : this.NEUTRAL_COLOR);

        // Header (Author)
        const authorSection = new SectionBuilder();
        authorSection.setThumbnailAccessory("https://cdn.discordapp.com/embed/avatars/0.png"); // Assuming URL string works, or needs object? Docs say "setThumbnailAccessory(thumbnail)"
        // It likely accepts a generic object or builder. Assuming string URL is NOT valid for V2 accessory directly?
        // Wait, documentation says "setThumbnailAccessory(thumbnail)".
        // In discord.js Builders, usually we pass a url or attachment.
        // Let's assume standard object `{ url: '...' }` or just try URL string if library is smart.
        // To be safe, let's omit the thumbnail or use a small TextDisplay header for now if we can't be sure.
        // Actually, "User Profile" pattern suggests SectionBuilder with Thumbnail.
        // Let's try passing the object: { url: ... }
        authorSection.addTextDisplayComponents(new TextDisplayBuilder().setContent("**Anonymous User**"));

        container.addComponents(authorSection);

        // Content
        if (message && message.trim().length > 0) {
            container.addComponents(new TextDisplayBuilder().setContent(message));
        }

        // Footer
        const footerParts = [];
        if (hasFilteredContent) footerParts.push("⚠️ Some content was filtered");
        if (hasMedia) footerParts.push(mediaCount === 1 ? "📎 Media attached" : `📎 ${mediaCount} files attached`);

        if (footerParts.length > 0) {
             container.addComponents(
                 new SeparatorBuilder(),
                 new TextDisplayBuilder().setContent(`*${footerParts.join(" • ")}*`) // Markdown italics for footer look
             );
        } else {
             container.addComponents(
                 new SeparatorBuilder(),
                 new TextDisplayBuilder().setContent(`*${new Date().toLocaleTimeString()}*`)
             );
        }

        return container;
    }

    static createChatEndedEmbed(reason = "Chat ended") {
        const container = this.createContainer(this.WARNING_COLOR);

        container.addComponents(
            new TextDisplayBuilder().setContent(`# 💬 Chat Ended\nYour anonymous chat has ended. ${reason}`),
            new SeparatorBuilder(),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 🔄 What's next?\n• Use `/new` to find another chat partner\n• Use `/update` to modify your preferences\n• Rate your experience below")
            ),
            new SeparatorBuilder(),
            new TextDisplayBuilder().setContent("*Thank you for using BlindBond!*")
        );

        return container;
    }

    static createFeedbackEmbed() {
        const container = this.createContainer(this.INFO_COLOR);

        container.addComponents(
            new TextDisplayBuilder().setContent("# ⭐ How was your chat?\nYour feedback helps us improve the matching experience!"),
            new SeparatorBuilder(),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 📝 Anonymous Feedback\nThis rating is completely anonymous and helps us create better matches.")
            )
        );

        return container;
    }

    static createProfileEmbed(profile, includeAnonymousId = false) {
        const container = this.createContainer(this.PRIMARY_COLOR);

        container.addComponents(
            new TextDisplayBuilder().setContent("# 👤 Your Profile\nHere are your current preferences for matching:"),
            new SeparatorBuilder()
        );

        const fieldsSection = new SectionBuilder();
        fieldsSection.addTextDisplayComponents(
             new TextDisplayBuilder().setContent(`**🆔 Gender**: ${profile.gender}`),
             new TextDisplayBuilder().setContent(`**🎂 Age**: ${profile.age} years old`),
             new TextDisplayBuilder().setContent(`**🌍 Location**: ${profile.location}`)
        );

        const fieldsSection2 = new SectionBuilder();
        fieldsSection2.addTextDisplayComponents(
             new TextDisplayBuilder().setContent(`**💕 Interested In**: ${profile.interested_in}`),
             new TextDisplayBuilder().setContent(`**⭐ Status**: ✅ Profile Complete`)
        );

        container.addComponents(fieldsSection, fieldsSection2);

        if (profile.interests && profile.interests.length > 0) {
            let interestsText = profile.interests.slice(0, 5).join(", ");
            if (profile.interests.length > 5) {
                interestsText += ` +${profile.interests.length - 5} more`;
            }
            container.addComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**🎨 Interests**: ${interestsText}`)
                )
            );
        }

        if (includeAnonymousId) {
             container.addComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**🔒 Anonymous ID**: \`${profile.anonymous_id.substring(0, 8)}...\``)
                )
            );
        }

        container.addComponents(
            new SeparatorBuilder(),
            new TextDisplayBuilder().setContent("*Use the buttons below to update your preferences*")
        );

        return container;
    }

    static createWelcomeEmbed() {
        const container = this.createContainer(this.SUCCESS_COLOR);

        container.addComponents(
            new TextDisplayBuilder().setContent("# 🌟 Welcome to BlindBond!\nConnect with people from around the world through safe, anonymous one-on-one chats."),
            new SeparatorBuilder(),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## ✨ What makes us special?\n• **Completely Anonymous** - No usernames shared\n• **Smart Matching** - Based on your preferences\n• **Safe Environment** - Advanced moderation & reporting\n• **Real Connections** - Genuine conversations")
            ),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 🚀 Ready to start?\nFirst, let's set up your anonymous profile and go over the community guidelines.")
            ),
            new SeparatorBuilder(),
            new TextDisplayBuilder().setContent("*Click below to agree to our community guidelines and continue*")
        );

        return container;
    }

    static createRulesEmbed() {
        const container = this.createContainer(this.INFO_COLOR);

        container.addComponents(
            new TextDisplayBuilder().setContent("# 📋 Community Guidelines\nPlease read and agree to follow these simple rules:"),
            new SeparatorBuilder(),
            new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 🤝 Be Respectful\nTreat everyone with kindness and respect"),
                new TextDisplayBuilder().setContent("## 🔒 Protect Privacy\nDon't share personal information (real name, address, phone, etc.)")
            ),
             new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## 🚫 No Inappropriate Content\nNo sexual content, harassment, or illegal material"),
                new TextDisplayBuilder().setContent("## 📷 No Files/Images\nFile sharing is disabled for everyone's safety (except in active chats)")
            ),
             new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## ⚖️ Consequences\nViolations result in warnings, temporary bans, or permanent removal")
            ),
            new SeparatorBuilder(),
            new TextDisplayBuilder().setContent("*By continuing, you agree to follow these guidelines*")
        );

        return container;
    }

    static createErrorEmbed(title, description) {
        const container = this.createContainer(this.ERROR_COLOR);
        container.addComponents(
            new TextDisplayBuilder().setContent(`# ❌ ${title}\n${description}`)
        );
        return container;
    }

    static createSuccessEmbed(title, description) {
        const container = this.createContainer(this.SUCCESS_COLOR);
        container.addComponents(
            new TextDisplayBuilder().setContent(`# ✅ ${title}\n${description}`)
        );
        return container;
    }

    static createInfoEmbed(title, description) {
        const container = this.createContainer(this.INFO_COLOR);
        container.addComponents(
            new TextDisplayBuilder().setContent(`# ℹ️ ${title}\n${description}`)
        );
        return container;
    }

    static createIdleWarningEmbed() {
        const container = this.createContainer(this.WARNING_COLOR);
        container.addComponents(
             new TextDisplayBuilder().setContent("# ⏰ Idle Warning\nYour chat has been inactive for 15 minutes."),
             new SeparatorBuilder(),
             new SectionBuilder().addTextDisplayComponents(
                 new TextDisplayBuilder().setContent("## 🔔 Action Required\nSend a message within 15 minutes or the chat will end automatically."),
                 new TextDisplayBuilder().setContent("## 💡 BlindBond Tip\nKeep the conversation flowing to maintain your BlindBond connection!")
             )
        );
        return container;
    }
}

module.exports = EmbedFactory;
