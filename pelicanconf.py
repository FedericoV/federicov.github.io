#!/usr/bin/env python
# -*- coding: utf-8 -*- #
from __future__ import unicode_literals

AUTHOR = u'Federico Vaggi'
SITENAME = u"Federico's Blog"
SITEURL = ''

PATH = 'content'
TIMEZONE = 'Europe/Paris'

DEFAULT_LANG = u'en'

# Feed generation is usually not desired when developing
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
TRANSLATION_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None

# Paths:
STATIC_PATHS = ['images', 'pdfs']
PAGE_PATHS = ['pages']
PAGE_EXCLUDES = ['widgets', '.ipynb_checkpoints']
ARTICLE_EXCLUDES = ['widgets', '.ipynb_checkpoints']

# Blogroll
LINKS = ()

# Social widget
SOCIAL =  (('@f_vaggi', 'http://twitter.com/f_vaggi'),)
DEFAULT_PAGINATION = 10
TWITTER_USERNAME = 'f_vaggi'

MARKUP = ('md', 'ipynb')

PLUGIN_PATHS = ['plugins']
PLUGINS = ['ipynb.markup']
DISPLAY_PAGES_ON_MENU = True

#MENUITEMS = []

# Uncomment following line if you want document-relative URLs when developing
#RELATIVE_URLS = True
