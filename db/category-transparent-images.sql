-- Replace only the previous starter category artwork; preserve custom uploads.
UPDATE site_settings SET value='catalogue/returnal-case.png',updated_at=CURRENT_TIMESTAMP WHERE key='category_image_games' AND value='catalogue/astro-bot.jpg';
