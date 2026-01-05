const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Update your profile preferences'),

    async execute(interaction) {
        const profile = db.getUserProfile(interaction.user.id);

        if (!profile || !profile.is_onboarded) {
            return interaction.reply({
                content: "You haven't set up your profile yet. Use `/onboard` to get started!",
                ephemeral: true
            });
        }

        const embed = EmbedFactory.createProfileEmbed(profile, true);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_edit_gender')
                    .setLabel('Edit Gender')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('profile_edit_age')
                    .setLabel('Edit Age')
                    .setStyle(ButtonStyle.Secondary),
                 new ButtonBuilder()
                    .setCustomId('profile_edit_interests')
                    .setLabel('Edit Interests')
                    .setStyle(ButtonStyle.Secondary),
            );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },

    // We reuse the profile update logic since the buttons have 'profile_' prefix
    // and are handled by 'profile' command handler or this one if routed.
    // However, interactionCreate routing relies on command name.
    // If I want buttons 'profile_edit_gender' to work here, interactionCreate
    // must route to 'profile' OR 'update'.

    // I should check interactionCreate.js to ensure it handles this properly.
    // Currently interactionCreate routes 'profile_' to 'profile' command.
    // If I use the same customIds, I should ensure 'profile' command logic is used OR duplicate logic.
    // Better: Duplicate logic here but keep customIds the same?
    // No, if I use the same customIds ('profile_...'), `interactionCreate.js` will route to `profile` command if it exists.
    // Does `profile` command exist? Yes.
    // So buttons will work even if served by `/update`, because interaction is routed by ID.
    // But `handleInteraction` must be accessible.

    // Actually, `interactionCreate.js` calls `commands.get('profile').handleInteraction`.
    // So I don't need to implement `handleInteraction` here IF `profile` command exists and is loaded.
    // But I should probably make `update.js` fully self-sufficient if `profile.js` is removed or they diverge.
    // Since request asked for `/update`, maybe I should just use `update.js` and have `profile` be an alias?
    // The previous implementation had `profile.js`.
    // I will duplicate logic for now to be safe, but since customIds start with `profile_`,
    // interactionCreate will try to route to `profile`.
    // I'll keep `profile.js` as well.
};
