# Wadduwage Lab Website

Academic website template built with Jekyll.

## Setup

1. Install Ruby and Bundler (if not already installed)
2. Install dependencies:
   ```bash
   bundle install
   ```

3. Build and serve locally:
   ```bash
   bundle exec jekyll serve
   ```
   
   **Note:** If you encounter an "inotify max watches exceeded" error, you have two options:
   
   **Option A:** Run without file watching (manual refresh):
   ```bash
   bundle exec jekyll serve --no-watch
   ```
   
   **Option B:** Increase the inotify limit (requires sudo):
   ```bash
   sudo sysctl fs.inotify.max_user_watches=524288
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   ```

4. Visit `http://localhost:4000` in your browser

## Structure

- `_config.yml` - Jekyll configuration
- `_layouts/default.html` - Main layout template
- `_data/team.yml` - Team member data
- `_data/publications.yml` - Publications data
- `assets/css/main.css` - Main stylesheet
- `index.html` - Homepage
- `team.html` - Team page
- `publications.html` - Publications page

## Customization

- Edit `_data/team.yml` to update team members
- Edit `_data/publications.yml` to update publications
- Edit `_config.yml` to change site settings
- Edit `assets/css/main.css` to customize styling
