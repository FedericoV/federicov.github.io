from pelican import signals
from pelican.generators import ArticlesGenerator

def filter_index_articles(generator: ArticlesGenerator) -> None:
    """
    Filters articles from the main index (homepage) generation if they are located
    in the 'content/archive' directory.
    
    This works by modifying the `generator.articles` list, which Pelican uses to 
    create the paginated index pages. We remove the archived articles from this list.
    
    However, we do NOT touch `generator.all_articles`. This ensures that:
    1. The "Archives" page still lists them.
    2. The "Category" and "Tag" pages still include them.
    
    Args:
        generator: The Pelican ArticlesGenerator object containing all processed articles.
    """
    
    # We create a new list for the homepage articles
    active_articles: list = []
    
    # Iterate through all processed articles
    for article in generator.articles:
        # Check if 'content/archive' is in the source path.
        if 'content/archive' in article.source_path:
            continue
        else:
            active_articles.append(article)
            
    # Replace the generator's article list with our filtered list
    generator.articles = active_articles

def register() -> None:
    """
    Connects our filter function to Pelican's 'article_generator_finalized' signal.
    """
    signals.article_generator_finalized.connect(filter_index_articles)
