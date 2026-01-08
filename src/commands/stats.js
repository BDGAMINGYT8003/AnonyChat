const { SlashCommandBuilder, MessageFlags, TextDisplayBuilder, SectionBuilder } = require('discord.js');
const matchmaking = require('../services/matchmaking');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics'),

    async execute(interaction) {
        const queueStats = matchmaking.getQueueStats();
        const activeSessions = db.getActiveSessions();
        const activeChats = activeSessions.length;

        const container = EmbedFactory.createContainer(0x3498db);
        container.addComponents(
             new TextDisplayBuilder().setContent("# 📊 Bot Statistics")
        );

        const section = new SectionBuilder();
        section.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Users in Queue**: ${queueStats.total}`),
            new TextDisplayBuilder().setContent(`**Active Chats**: ${activeChats}`),
            new TextDisplayBuilder().setContent(`**Average Wait Time**: ${queueStats.avgWaitTime.toFixed(1)} min`)
        );
        container.addComponents(section);

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
};
