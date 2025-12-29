AUTHOR = 'Federico Vaggi'
SITENAME = "Federico's Blog"
SITETITLE = "Federico Vaggi"
SITESUBTITLE = "Systems Biology, Machine Learning, and Scientific Python"
SITELOGO = '/images/profile.jpg'
SITEURL = ''

PATH = 'content'
TIMEZONE = 'America/Los_Angeles'

DEFAULT_LANG = 'en'

# Theme
THEME = 'theme-flex'

# Feed generation is usually not desired when developing
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
TRANSLATION_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None

# Paths:
STATIC_PATHS = ['images', 'pdfs', 'extra']
EXTRA_PATH_METADATA = {
    'extra/custom.css': {'path': 'custom.css'},
}
CUSTOM_CSS = 'custom.css'
PAGE_PATHS = ['pages']
PAGE_EXCLUDES = ['widgets', '.ipynb_checkpoints']
ARTICLE_EXCLUDES = ['widgets', '.ipynb_checkpoints']

# Blogroll
LINKS = ()

# Social widget (Flex uses Font Awesome icon names)
SOCIAL = (
    ('github', 'https://github.com/FedericoV'),
    ('twitter', 'https://twitter.com/f_vaggi'),
    ('linkedin', 'https://www.linkedin.com/in/federico-vaggi-ba72a654')
)

DEFAULT_PAGINATION = 10

# Markup settings
MARKUP = ('md',)

DISPLAY_PAGES_ON_MENU = True

# Flex theme settings
MAIN_MENU = True
MENUITEMS = (
    ('Archives', '/archives.html'),
    ('Categories', '/categories.html'),
)

# Code highlighting
PYGMENTS_STYLE = 'monokai'

# Dark mode support
THEME_COLOR_AUTO_DETECT_BROWSER_PREFERENCE = True
THEME_COLOR_ENABLE_USER_OVERRIDE = True

# Uncomment following line if you want document-relative URLs when developing
# RELATIVE_URLS = True
