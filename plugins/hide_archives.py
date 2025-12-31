from pelican import signals
from pelican.generators import ArticlesGenerator

def mark_archive_articles(generator: ArticlesGenerator) -> None:
    """
    Marks articles located in 'content/archive' with a .is_archive flag.
    
    This allows templates (like index.html) to filter them out without removing
    them from the global build process (which would prevent them from being written
    to disk or appearing in the Archives page).
    
    Args:
        generator: The Pelican ArticlesGenerator object.
    """
    
    for article in generator.articles:
        # Check if 'content/archive' is in the source path.
        if 'content/archive' in article.source_path:
            article.is_archive = True
        else:
            article.is_archive = False

def register() -> None:
    """
    Connects our filter function to Pelican's 'article_generator_finalized' signal.
    """
    signals.article_generator_finalized.connect(mark_archive_articles)