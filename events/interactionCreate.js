const { Events } = require('discord.js');
const db = require('../services/database');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Global State Check (Locking)
                // This logic could be inside specific commands or here globally.
                // For "360-degree safety railguard", we should check state before execution.
                // However, different commands require different states.
                // Let the command handle its own state requirements or pass a state checker.

                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followup({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            // Handle interactive components
            // We can look up the command that owns this component or handle it generically if named conventionally
            // Or better, commands can export component handlers, or we use a separate handler system.
            // For simplicity in migration, I'll check customIds.

            // Example: "onboard_gender_male" -> Handle in onboard command logic?
            // A common pattern is `commandName:action:args`.

            // For this specific bot, the Python code used dynamic view callbacks.
            // In Node.js discord.js, we often need to route manually unless we keep a collector active (which is memory intensive for persistent bots).
            // We will route based on customId prefixes.

            const customId = interaction.customId;

            if (customId.startsWith('onboard_') || customId.startsWith('profile_')) {
                const command = interaction.client.commands.get('onboard'); // Re-use onboard logic or profile logic
                 // If the logic is shared, maybe move to a util or service.
                 // Actually, let's try to delegate to the relevant command file if it exports a handler.

                 // Since we don't have a sophisticated router yet, I will handle basic ones here or delegate.
                 // Let's implement specific handlers in the commands and import them here?
                 // Or just load them all.

                 if (customId.startsWith('onboard_') && interaction.client.commands.has('onboard')) {
                     await interaction.client.commands.get('onboard').handleInteraction(interaction);
                 } else if (customId.startsWith('profile_') && interaction.client.commands.has('profile')) {
                     await interaction.client.commands.get('profile').handleInteraction(interaction);
                 }
            } else if (customId.startsWith('share_')) {
                if (interaction.client.commands.has('share')) {
                    await interaction.client.commands.get('share').handleInteraction(interaction);
                }
            } else if (customId.startsWith('report_')) {
                if (interaction.client.commands.has('report')) {
                    await interaction.client.commands.get('report').handleInteraction(interaction);
                }
            }
        }
    },
};
