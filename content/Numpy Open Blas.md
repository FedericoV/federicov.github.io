Title: NumPy 1.10+ changes with openBLAS
Date: 2014-09-15
Category: Programming
Tags: [Python, openBLAS, NumPy]
Slug: NumPy1.10+andopenblas

[OpenBLAS](https://github.com/xianyi/OpenBLAS) is a terrific open source implementation of the BLAS libraries, forked from the no-longer maintained [gotoblas](https://www.tacc.utexas.edu/tacc-projects/gotoblas2).  It's free, fast, available under a fairly permissive license, and quite easy to compile (unlike ATLAS).

Almost all scientific programming languages use BLAS under the hood to do the numerical heavy lifting for all linear algebra routines, and NumPy is no exception.  There are lots of [excellent](http://myvirtualbrain.blogspot.it/2013/01/compiling-and-installing-numpy-with.html) [guides](http://osdf.github.io/blog/numpyscipy-with-openblas-for-ubuntu-1204-second-try.html) to building OpenBLAS and linking it with NumPy.


However, since until recently, building NumPy with OpenBLAS required a fair bit of tinkering, all the guides suggest testing to see if your build process worked like [so](https://gist.github.com/osdf/3842524#file_test_numpy.py).  Since the NumPy 1.9 release though, all subsequent builds however changed so *numpy.core._dotblas* is no longer built as a standalone file.

**From 1.10 the release notes:**

* The _dotblas module is no longer available.

If you are smart enough to actually read through the release notes before building a package, I admire your discipline, and you've earned the right to feel smug for the rest of the day.  I, however, struggled like an idiot for 2 hours trying to figure out why _dotblas wasn't getting built.  Relying on a private API module to check for a succesful build wasn't a very good idea in the first place - but if you want to check if NumPy succesfully linked openblas, do this instead:


    ::::python
    >>> from numpy.distutils.system_info import get_info
    >>> get_info('blas')
    {'libraries': ['openblas'], 'library_dirs': ['/opt/OpenBLAS/lib'], 'define_macros': [('HAVE_CBLAS', None)], 'language': 'c'}
    >>> get_info('lapack')
    {'libraries': ['openblas'], 'library_dirs': ['/opt/OpenBLAS/lib'], 'language': 'f77'}