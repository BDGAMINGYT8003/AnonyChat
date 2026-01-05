const { Events, ChannelType } = require('discord.js');
const chatService = require('../services/chat');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages and non-DM messages
        if (message.author.bot || message.channel.type !== ChannelType.DM) return;

        await chatService.handleMessage(message);
    },
};
