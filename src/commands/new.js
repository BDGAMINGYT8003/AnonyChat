const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../services/database');
const matchmaking = require('../services/matchmaking');
const safety = require('../services/safety');
const chatService = require('../services/chat');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('new')
        .setDescription('Find a new chat partner'),

    async execute(interaction) {
        // 1. Check Safety Status
        const safetyStatus = safety.checkUserSafetyStatus(interaction.user.id);
        if (!safetyStatus.isAllowed) {
            return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Access Denied", safetyStatus.reason)],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // 2. Check Profile Existence
        const profile = db.getUserProfile(interaction.user.id);
        if (!profile || !profile.is_onboarded) {
            return interaction.reply({
                components: [EmbedFactory.createInfoEmbed("Profile Required", "Please set up your profile first using `/onboard`.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // 3. Check Active Session
        const activeSession = db.getActiveSessionForUser(interaction.user.id);
        if (activeSession) {
            return interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Active Session", "You are already in a chat! Use `/leave` to end it first.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // 4. Check if already in queue
        const position = matchmaking.getQueuePosition(interaction.user.id);
        if (position) {
            return interaction.reply({
                components: [EmbedFactory.createInfoEmbed("Already Searching", "You are already in the queue! Please wait...")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // 5. Add to Queue
        const added = await matchmaking.addToQueue(interaction.user.id, profile.anonymous_id);

        if (added) {
            const queueSize = matchmaking.getQueueSize();
            await interaction.reply({
                components: [EmbedFactory.createSearchEmbed(queueSize)],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });

            // Trigger match attempt
            await this.attemptMatch(interaction.user.id, interaction.client);
        } else {
            await interaction.reply({
                components: [EmbedFactory.createErrorEmbed("Queue Error", "Failed to join queue.")],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },

    async attemptMatch(userId, client) {
        try {
            const match = await matchmaking.findMatch(userId);

            if (match) {
                await chatService.startChatSession(
                    client,
                    match.user1.user_id,
                    match.user2.user_id,
                    match.user1.anonymous_id,
                    match.user2.anonymous_id
                );
            }
        } catch (error) {
            console.error("Matchmaking error:", error);
        }
    }
};
