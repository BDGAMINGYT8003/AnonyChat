const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const matchmaking = require('../services/matchmaking');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics'),

    async execute(interaction) {
        const queueStats = matchmaking.getQueueStats();
        const activeSessions = db.getActiveSessions(); // This method returns array
        const activeChats = activeSessions.length;

        const embed = new EmbedBuilder()
            .setTitle("📊 Bot Statistics")
            .setColor(0x3498db)
            .addFields(
                { name: "Users in Queue", value: `${queueStats.total}`, inline: true },
                { name: "Active Chats", value: `${activeChats}`, inline: true },
                { name: "Average Wait Time", value: `${queueStats.avgWaitTime.toFixed(1)} min`, inline: true }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
