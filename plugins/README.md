# Hide Archives Plugin

This simple Pelican plugin filters out articles located in the `content/archive/` directory from the main homepage (Index), while keeping them accessible via the Archives, Categories, and Tags pages.

## How it works

1. It hooks into the `article_generator_finalized` signal.
2. It iterates through the `generator.articles` list (which Pelican uses for the Index page).
3. If an article's path contains `content/archive`, it is removed from that list.
4. `generator.all_articles` is left untouched, preserving the posts in the global Archives.

## Usage

1. Ensure this folder is in your `PLUGINS` path in `pelicanconf.py`.
2. Add `hide_archives` to your `PLUGINS` list.
